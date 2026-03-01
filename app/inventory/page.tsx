"use client";

import { useEffect, useState } from "react";
import { InventoryItem } from "@/types/inventory";
import { useGameStore } from "@/lib/store/useGameStore";
import { ITEM_DEFS, ItemDef } from "@/game/config/items";
import { createClient } from "@/lib/supabase/client";

type ExportGroup = {
    def: ItemDef;
    total: number;      // 장착 포함 전체 보유 수
    exportable: number; // 장착 제외, 실제 내보내기 가능 수
};

type DbItemGroup = {
    inGameItemId: string;
    total: number;
    available: number;
    minting: number;
    minted: number;
    failed: number;
};

export default function InventoryPage() {
    const supabase = createClient();
    const [userId, setUserId] = useState<string | null>(null);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [selectedInGameItemId, setSelectedInGameItemId] = useState<string | null>(null);
    const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
    const [walletAddress, setWalletAddress] = useState("");
    const [isWalletSaved, setIsWalletSaved] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setUserId(user.id);
        });
    }, []);

    useEffect(() => {
        if (userId) fetchItems();
    }, [userId]);

    const fetchItems = async () => {
        if (!userId) return;
        try {
            const res = await fetch(`/api/inventory?game_user_id=${userId}`);
            const data = await res.json();
            if (data.items) setItems(data.items);
        } catch (err) {
            console.error("Failed to fetch items", err);
        }
    };

    const exportItems = async (inGameItemId: string, quantity: number) => {
        if (!isWalletSaved || !walletAddress) {
            alert("먼저 ForTem 지갑 주소를 입력하고 저장해주세요!");
            return;
        }
        if (!userId) return;

        const itemDef = ITEM_DEFS[inGameItemId];
        const itemName = itemDef?.name || inGameItemId;
        const bundleLabel = quantity > 1 ? ` x${quantity} (묶음 NFT)` : '';

        const confirmExport = confirm(
            `${itemName}${bundleLabel}을(를) ForTem 컬렉션으로 내보내시겠습니까?\n내보내기가 완료되면 해당 아이템은 게임 내 인벤토리에서 영구적으로 소각(Burn)됩니다.`
        );
        if (!confirmExport) return;

        setLoading(true);
        setMessage(`${itemName} x${quantity} 민팅 요청 중...`);

        try {
            const res = await fetch("/api/fortem/mint/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    game_user_id: userId,
                    in_game_item_id: inGameItemId,
                    quantity,
                    wallet_address: walletAddress,
                    metadata: {
                        name: itemName,
                        attributes: [{ trait_type: "Attack", value: 100 }]
                    }
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "민팅 중 문제가 발생했습니다.");

            setMessage(`성공! ${data.quantity}개 묶음 NFT 발행 완료. 트랜잭션: ${data.transaction_id}`);
            setSelectedInGameItemId(null);
            setSelectedQuantity(1);
            fetchItems();
        } catch (error: any) {
            console.error(error);
            setMessage(`에러 발생: ${error.message}`);
            fetchItems();
        } finally {
            setLoading(false);
        }
    };

    const gameStore = useGameStore();

    // Zustand 아이템을 in_game_item_id 기준으로 그룹화
    const exportableGroups: ExportGroup[] = (() => {
        const groups: Record<string, ExportGroup> = {};
        for (const item of gameStore.inventory.filter(i => i.def.isExportable)) {
            const key = item.def.id;
            if (!groups[key]) groups[key] = { def: item.def, total: 0, exportable: 0 };
            groups[key].total++;
            const isEquipped = Object.values(gameStore.equipped).some(e => e?.uid === item.uid);
            if (!isEquipped) groups[key].exportable++;
        }
        return Object.values(groups);
    })();

    // DB 아이템을 in_game_item_id 기준으로 그룹화
    const dbGroups: DbItemGroup[] = (() => {
        const groups: Record<string, DbItemGroup> = {};
        for (const item of items) {
            const key = item.in_game_item_id;
            if (!groups[key]) groups[key] = { inGameItemId: key, total: 0, available: 0, minting: 0, minted: 0, failed: 0 };
            groups[key].total++;
            if (item.status === 'available') groups[key].available++;
            else if (item.status === 'minting_in_progress') groups[key].minting++;
            else if (item.status === 'minted') groups[key].minted++;
            else if (item.status === 'mint_failed') groups[key].failed++;
        }
        return Object.values(groups);
    })();

    const selectedGroup = exportableGroups.find(g => g.def.id === selectedInGameItemId) ?? null;

    return (
        <div className="p-8 max-w-4xl mx-auto font-sans">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => window.location.href = '/game'}
                        className="bg-gray-800 text-white px-4 py-2 rounded font-bold hover:bg-gray-700 transition"
                    >
                        ← 게임 로비로 돌아가기
                    </button>
                    <h1 className="text-3xl font-bold">내 인벤토리 (ForTem 상점)</h1>
                </div>
                <span className="text-xl font-bold text-yellow-500">포인트: {gameStore.points}pt</span>
            </div>

            {/* NFT 내보내기 섹션 */}
            <div className="bg-gray-50 p-6 rounded-lg mb-8 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">내보내기 가능한 아이템 (NFT 후보)</h2>

                {/* 아이템 카드 그리드 — in_game_item_id 기준으로 병합 표시 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {exportableGroups.map(group => {
                        const isSelected = selectedInGameItemId === group.def.id;
                        const canExport = group.exportable > 0;
                        const rarityColor = group.def.rarity === "epic"
                            ? "border-purple-400"
                            : group.def.rarity === "rare"
                                ? "border-blue-400"
                                : "border-gray-300";

                        return (
                            <div
                                key={group.def.id}
                                onClick={() => {
                                    if (!canExport) {
                                        alert("모든 아이템이 장착 중입니다. 먼저 장착을 해제해주세요.");
                                        return;
                                    }
                                    setSelectedInGameItemId(group.def.id);
                                    setSelectedQuantity(1);
                                }}
                                className={`bg-white p-4 rounded-xl border-2 ${rarityColor} text-center cursor-pointer transition relative
                                    ${isSelected ? 'ring-4 ring-purple-500 shadow-lg scale-105' : 'hover:shadow-md'}
                                    ${!canExport ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {/* 보유 수량 뱃지 */}
                                <span className="absolute -top-3 -right-3 bg-gray-700 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                    x{group.total}
                                </span>
                                {/* NFT 뱃지 */}
                                <span className="absolute -top-3 -left-3 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md border border-purple-300">
                                    💎 NFT
                                </span>

                                <h3 className="font-bold text-lg mt-2 mb-1 text-gray-800">{group.def.name}</h3>
                                <p className="text-sm text-purple-600 font-semibold capitalize mb-2">{group.def.rarity}</p>

                                {!canExport ? (
                                    <span className="block mt-2 text-xs text-red-500 font-bold bg-red-50 py-1 rounded">
                                        모두 장착 중 (불가)
                                    </span>
                                ) : (
                                    <span className="block mt-2 text-xs text-green-600 font-bold bg-green-50 py-1 rounded border border-green-200">
                                        내보내기 가능: {group.exportable}개
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {exportableGroups.length === 0 && (
                        <div className="col-span-full text-center text-gray-500 py-12 bg-white rounded border border-dashed border-gray-300">
                            <p className="text-lg font-semibold mb-2">저런! 내보낼 수 있는 호화로운 아이템이 없네요.</p>
                            <p className="text-sm">게임 로비로 돌아가 사냥을 통해 💎NFT 마크가 있는 Epic 아이템을 획득해보세요!</p>
                        </div>
                    )}
                </div>

                {/* 수량 선택 UI — 보유 수량 2개 이상일 때만 노출 */}
                {selectedGroup && selectedGroup.exportable > 1 && (
                    <div className="bg-white border border-purple-300 rounded-lg p-4 mb-4">
                        <p className="text-sm font-semibold text-purple-800 mb-3">
                            {selectedGroup.def.name} — 내보낼 수량 선택 (최대 {selectedGroup.exportable}개)
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSelectedQuantity(q => Math.max(1, q - 1))}
                                className="w-9 h-9 rounded-full bg-gray-200 font-bold text-xl hover:bg-gray-300 flex items-center justify-center"
                            >
                                −
                            </button>
                            <input
                                type="number"
                                min={1}
                                max={selectedGroup.exportable}
                                value={selectedQuantity}
                                onChange={(e) => {
                                    const v = Math.max(1, Math.min(selectedGroup.exportable, parseInt(e.target.value) || 1));
                                    setSelectedQuantity(v);
                                }}
                                className="w-20 text-center border border-gray-300 rounded px-2 py-1 font-bold text-lg"
                            />
                            <button
                                onClick={() => setSelectedQuantity(q => Math.min(selectedGroup.exportable, q + 1))}
                                className="w-9 h-9 rounded-full bg-gray-200 font-bold text-xl hover:bg-gray-300 flex items-center justify-center"
                            >
                                +
                            </button>
                            <span className="text-sm text-gray-500">/ {selectedGroup.exportable}개</span>
                            <button
                                onClick={() => setSelectedQuantity(selectedGroup.exportable)}
                                className="ml-auto text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200 font-semibold"
                            >
                                전체 선택
                            </button>
                        </div>
                        {selectedQuantity > 1 && (
                            <p className="text-xs text-orange-600 mt-3 bg-orange-50 border border-orange-200 rounded p-2">
                                ⚠️ {selectedQuantity}개가 1개의 묶음 NFT로 발행됩니다. 발행 후 낱개 분할 판매는 불가합니다.
                            </p>
                        )}
                    </div>
                )}

                {/* 글로벌 내보내기 CTA */}
                <div className="bg-purple-100 p-6 rounded-lg text-center border border-purple-200">
                    <h3 className="text-lg font-bold text-purple-800 mb-2">선택한 아이템을 ForTem 컬렉션으로 내보내기</h3>
                    {selectedGroup ? (
                        <p className="text-sm text-purple-600 mb-4">
                            {selectedGroup.def.name} x{selectedQuantity} →
                            {selectedQuantity > 1 ? ' 1개의 묶음 NFT로 발행 (분할 불가)' : ' 1개의 NFT로 발행'}
                        </p>
                    ) : (
                        <p className="text-sm text-purple-600 mb-4">
                            N개를 1개의 통짜(Indivisible) NFT로 묶어 안전하게 내보낼 수 있습니다.
                        </p>
                    )}
                    <button
                        onClick={() => {
                            if (!selectedInGameItemId) return;
                            exportItems(selectedInGameItemId, selectedQuantity);
                        }}
                        disabled={!selectedInGameItemId || loading}
                        className={`w-full max-w-md mx-auto block py-3 rounded-lg text-lg font-bold shadow transition-all
                            ${selectedInGameItemId && !loading
                                ? 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg transform hover:-translate-y-1'
                                : 'bg-gray-300 text-gray-400 cursor-not-allowed'}`}
                    >
                        {loading
                            ? '처리 중...'
                            : selectedInGameItemId
                                ? `💎 ${ITEM_DEFS[selectedInGameItemId]?.name} x${selectedQuantity} 내보내기 (Export)`
                                : '아이템을 먼저 선택해주세요'}
                    </button>
                </div>
            </div>

            {/* 지갑 주소 섹션 */}
            <div className="bg-gray-100 p-6 rounded-lg mb-8 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">NFT 민팅 지갑 주소 (ForTem)</h2>
                {isWalletSaved ? (
                    <div className="flex items-center justify-between bg-white p-4 rounded border border-purple-200">
                        <div className="overflow-hidden mr-4">
                            <span className="text-purple-600 font-bold mr-2">✓ 등록된 주소:</span>
                            <span className="text-gray-700 font-mono break-all text-sm">{walletAddress}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-gray-600">Export를 진행할 ForTem 지갑 주소를 정확히 입력해주세요.</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="0x..."
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value.trim())}
                                className="border border-gray-300 rounded px-4 py-2 flex-grow focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                            <button
                                onClick={() => {
                                    if (walletAddress.length < 5) {
                                        alert("올바른 지갑 주소를 입력해주세요.");
                                        return;
                                    }
                                    const confirmSave = confirm("지갑 주소는 최초 1회 저장 후 수정할 수 없습니다.\n정말 이 주소로 저장하시겠습니까?");
                                    if (confirmSave) setIsWalletSaved(true);
                                }}
                                className="bg-purple-600 text-white px-6 py-2 rounded font-semibold hover:bg-purple-700 transition"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ForTem 진행 현황 (DB) */}
            <div className="flex justify-between items-center mb-6 mt-12">
                <h2 className="text-2xl font-semibold">ForTem 내보내기 진행 현황 (서버 연동됨)</h2>
            </div>

            {message && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 text-blue-700">
                    {message}
                </div>
            )}

            {/* DB 아이템도 in_game_item_id 기준으로 묶어서 표시 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {dbGroups.length > 0 ? dbGroups.map(group => {
                    const itemDef = ITEM_DEFS[group.inGameItemId];
                    const hasFailed = group.failed > 0;

                    return (
                        <div
                            key={group.inGameItemId}
                            className={`p-4 rounded-lg shadow-sm relative ${hasFailed ? 'border border-red-300 bg-red-50' : 'border border-purple-200 bg-purple-50'}`}
                        >
                            {/* 총 수량 뱃지 */}
                            <span className={`absolute -top-2 -right-2 text-white text-xs font-bold px-2 py-1 rounded-full shadow ${hasFailed ? 'bg-red-500' : 'bg-purple-600'}`}>
                                {hasFailed ? '⚠️' : '💎'} x{group.total}
                            </span>

                            <h3 className="text-lg font-bold mb-1">{itemDef ? itemDef.name : group.inGameItemId}</h3>
                            <p className="text-xs text-gray-500 mb-2 capitalize">{itemDef ? itemDef.rarity : 'Unknown'}</p>

                            {/* 상태별 카운트 */}
                            <div className="text-xs space-y-0.5 mb-2">
                                {group.available > 0 && <p className="text-green-600">대기: {group.available}개</p>}
                                {group.minting > 0 && <p className="text-orange-500">민팅중: {group.minting}개</p>}
                                {group.minted > 0 && <p className="text-blue-600 font-bold">완료: {group.minted}개</p>}
                                {group.failed > 0 && <p className="text-red-500 font-bold">실패: {group.failed}개</p>}
                            </div>

                            {hasFailed && (
                                <button
                                    onClick={() => exportItems(group.inGameItemId, group.failed)}
                                    disabled={loading}
                                    className="mt-1 w-full text-xs bg-red-500 text-white py-1.5 rounded font-bold hover:bg-red-600 disabled:opacity-50 transition"
                                >
                                    재시도 x{group.failed} (Retry)
                                </button>
                            )}
                        </div>
                    );
                }) : (
                    <p className="col-span-full text-center text-gray-500 py-8">
                        인벤토리가 비어있습니다. 게임을 플레이하여 아이템을 획득해보세요!
                    </p>
                )}
            </div>
        </div>
    );
}
