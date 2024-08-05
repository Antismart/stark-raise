import React, { useState, useEffect } from 'react';
import { RpcProvider } from 'starknet';
import Crowdfunding from './components/crowdfunding';

export const StarknetContext = React.createContext(null);

function App() {
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initProvider = async () => {
      console.log("Initializing provider...");
      try {
        const nodeUrl = import.meta.env.VITE_NODE_URL;
        console.log("Node URL:", nodeUrl);
        if (!nodeUrl) {
          throw new Error("Node URL is not defined in environment variables");
        }

        const provider = new RpcProvider({ nodeUrl });
        console.log("Provider created, attempting to get chain ID...");
        const chainId = await provider.getChainId();
        console.log("Chain ID retrieved:", chainId);
        setProvider(provider);
      } catch (error) {
        console.error("Failed to connect to StarkNet node", error);
        setError(error.message);
      }
    };
    initProvider();
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!provider) {
    return <div>Loading StarkNet provider... If this takes too long, check your network connection and node URL.</div>;
  }

  return (
    <StarknetContext.Provider value={provider}>
      <div className="App">
        <Crowdfunding />
      </div>
    </StarknetContext.Provider>
  );
}

export default App;