"use client";

import { useEffect, useState } from "react";

const TEST_USER_ID = "usr_test_12345";
const TEST_STUDIO_ID = "std_test_abcde";
const NETWORK = "sui-testnet";

export default function InventoryPage() {
    const [items, setItems] = useState<any[]>([]);
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
        if (!walletAddress.trim()) {
            alert("Sui 지갑 주소를 입력해주세요!");
            return;
        }
        localStorage.setItem("fortem_wallet_address", walletAddress);
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
                    studio_id: TEST_STUDIO_ID,
                    game_user_id: TEST_USER_ID,
                    network: NETWORK,
                    in_game_item_id: itemId,
                    wallet_address: walletAddress,
                    metadata: { name: `Item ${itemId}`, attack: 100 }
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "민팅 실패");
            }

            setMessage(`성공! 트랜잭션: ${data.transaction_id}`);
            fetchItems();

        } catch (error: any) {
            console.error(error);
            setMessage(`에러 발생: ${error.message} (DB 롤백 완료됨)`);
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
                        <div>
                            <span className="text-green-600 font-bold mr-2">✓ 연결됨:</span>
                            <span className="text-gray-700 font-mono">{walletAddress}</span>
                        </div>
                        <button
                            onClick={() => setIsWalletSaved(false)}
                            className="text-sm text-gray-500 underline hover:text-gray-700"
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
                            상태: <span className="font-semibold">{item.status}</span>
                        </p>
                        <button
                            onClick={() => exportItem(item.in_game_item_id)}
                            disabled={loading || item.is_minted || item.status !== 'available'}
                            className="w-full bg-black text-white px-4 py-2 rounded disabled:bg-gray-400 hover:bg-gray-800 transition"
                        >
                            {item.is_minted ? "내보내기 완료" : item.status !== 'available' ? "처리 중..." : "ForTem으로 내보내기 (Export)"}
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
