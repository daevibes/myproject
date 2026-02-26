"use client";

import { useEffect, useState } from "react";
import { InventoryItem } from "@/types/inventory";

const TEST_USER_ID = "usr_test_12345";

// #10. Sui 지갑 주소 정규식
const SUI_ADDRESS_REGEX = /^0x[a-fA-F0-9]{64}$/;

export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [walletAddress, setWalletAddress] = useState("");
    const [isWalletSaved, setIsWalletSaved] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        fetchItems();
        const savedWallet = localStorage.getItem("fortem_wallet_address");
        if (savedWallet) {
            setWalletAddress(savedWallet);
            setIsWalletSaved(true);
        }
    }, []);

    const fetchItems = async () => {
        try {
            const res = await fetch(`/api/inventory?game_user_id=${TEST_USER_ID}`);
            const data = await res.json();
            if (data.items) setItems(data.items);
        } catch (err) {
            console.error("Failed to fetch items", err);
        }
    };

    const handleSaveWallet = () => {
        const trimmed = walletAddress.trim();
        // #10. 클라이언트 사이드 검증 추가
        if (!SUI_ADDRESS_REGEX.test(trimmed)) {
            alert("유효한 Sui 지갑 주소를 입력해주세요 (0x + 64자리 hex)");
            return;
        }
        localStorage.setItem("fortem_wallet_address", trimmed);
        setWalletAddress(trimmed);
        setIsWalletSaved(true);
        setMessage("지갑 주소가 저장되었습니다. 이제 아이템을 내보낼 수 있습니다!");
    };

    const exportItem = async (itemId: string) => {
        if (!isWalletSaved || !walletAddress) {
            alert("먼저 지갑 주소를 입력하고 저장해주세요!");
            return;
        }

        setLoading(true);
        setMessage(`아이템(${itemId}) 민팅 요청 중...`);

        try {
            const res = await fetch("/api/fortem/mint/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    game_user_id: TEST_USER_ID,
                    in_game_item_id: itemId,
                    wallet_address: walletAddress,
                    metadata: { name: `Item ${itemId}`, attributes: [{ trait_type: "Attack", value: 100 }] }
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                // #15. UX 메시지 개선
                throw new Error(data.error || "민팅 중 문제가 발생했습니다.");
            }

            setMessage(`성공! 트랜잭션: ${data.transaction_id}`);
            fetchItems();

        } catch (error: any) {
            console.error(error);
            // #15 해결: UX 메시지 "롤백 완료" -> "상태 복구 중"으로 수정
            setMessage(`에러 발생: ${error.message} (상태 복구 중)`);
            fetchItems();
        } finally {
            setLoading(false);
        }
    };

    const createSampleItem = async () => {
        setLoading(true);
        await fetch("/api/inventory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ game_user_id: TEST_USER_ID })
        });
        setMessage("샘플 아이템이 추가되었습니다.");
        fetchItems();
        setLoading(false);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto font-sans">
            <h1 className="text-3xl font-bold mb-6">내 인벤토리 (ForTem 상점)</h1>

            <div className="bg-gray-100 p-6 rounded-lg mb-8 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">내 Sui 지갑 연결</h2>
                {!isWalletSaved ? (
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Sui 지갑 주소를 붙여넣으세요 (0x...)"
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                        />
                        <button
                            onClick={handleSaveWallet}
                            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 whitespace-nowrap"
                        >
                            지갑 저장
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between bg-white p-4 rounded border border-green-200">
                        <div className="overflow-hidden mr-4">
                            <span className="text-green-600 font-bold mr-2">✓ 연결됨:</span>
                            <span className="text-gray-700 font-mono break-all text-xs">{walletAddress}</span>
                        </div>
                        <button
                            onClick={() => setIsWalletSaved(false)}
                            className="text-sm text-gray-500 underline hover:text-gray-700 whitespace-nowrap"
                        >
                            지갑 변경
                        </button>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">보유 아이템</h2>
                <button
                    onClick={createSampleItem}
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                >
                    + 샘플 아이템 생성
                </button>
            </div>

            {message && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 text-blue-700">
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((item) => (
                    <div key={item.id} className="border p-6 rounded-lg shadow hover:shadow-md transition">
                        <h3 className="text-lg font-bold mb-2">{item.in_game_item_id}</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            상태: <span className={`font-semibold ${item.status === 'mint_failed' ? 'text-red-500' :
                                item.status === 'minting_in_progress' ? 'text-orange-500' : 'text-gray-700'
                                }`}>{item.status}</span>
                        </p>

                        {/* #05 UI: mint_failed 상태일 경우 다시 시도 가능하게 하거나 알림 */}
                        <button
                            onClick={() => exportItem(item.in_game_item_id)}
                            disabled={loading || item.is_minted || item.status === 'minting_in_progress'}
                            className="w-full bg-black text-white px-4 py-2 rounded disabled:bg-gray-400 hover:bg-gray-800 transition"
                        >
                            {item.is_minted ? "내보내기 완료" :
                                item.status === 'minting_in_progress' ? "처리 중..." :
                                    item.status === 'mint_failed' ? "다시 시도" : "내보내기 (Export)"}
                        </button>
                    </div>
                ))}
                {items.length === 0 && (
                    <p className="col-span-full text-center text-gray-500 py-8">
                        인벤토리가 비어있습니다. 샘플 아이템을 생성해 보세요!
                    </p>
                )}
            </div>
        </div>
    );
}
