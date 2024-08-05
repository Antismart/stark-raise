import React, { useState, useEffect, useContext } from 'react';
import { Contract, Account, uint256 } from 'starknet';
import { StarknetContext } from '../App';  // Adjust the import path as needed

const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
const privateKey = import.meta.env.VITE_PRIVATE_KEY;
const accountAddress = import.meta.env.VITE_ACCOUNT_ADDRESS;

import { ABI } from '../assets/ABI';

const Crowdfunding = () => {
  const provider = useContext(StarknetContext);
  const [contract, setContract] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [newCampaign, setNewCampaign] = useState({ goal: '', deadline: '' });
  const [campaignCount, setCampaignCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');

  useEffect(() => {
    const initContract = async () => {
      if (provider) {
        try {
          console.log("Initializing contract...");
          console.log("Contract Address:", contractAddress);
          console.log("Account Address:", accountAddress);
          if (!contractAddress || !privateKey || !accountAddress) {
            throw new Error("Missing environment variables");
          }
          const account = new Account(provider, accountAddress, privateKey);
          const contract = new Contract(ABI, contractAddress, provider);
          contract.connect(account);
          setContract(contract);
          console.log("Contract initialized successfully");
        } catch (error) {
          console.error('Error initializing contract:', error);
          setError('Failed to initialize contract: ' + error.message);
        }
      }
    };
    initContract();
  }, [provider]);

  useEffect(() => {
    const fetchCampaignCount = async () => {
      if (contract) {
        try {
          console.log("Fetching campaign count...");
          const count = await contract.get_campaign_count();
          console.log("Campaign count:", count.toString());
          setCampaignCount(Number(count.toString()));
        } catch (error) {
          console.error('Error fetching campaign count:', error);
          setError('Failed to fetch campaign count: ' + error.message);
        }
      }
    };
    fetchCampaignCount();
  }, [contract]);
  
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (contract && campaignCount > 0) {
        try {
          setLoading(true);
          const fetchedCampaigns = await Promise.all(
            Array.from({ length: campaignCount }, async (_, i) => {
              const campaign = await contract.get_campaign(i + 1);
              return {
                id: i + 1,
                creator: campaign.creator,
                goal: uint256.uint256ToBN(campaign.goal).toString(),
                deadline: Number(campaign.deadline.toString()),
                amount_raised: uint256.uint256ToBN(campaign.amount_raised).toString(),
                claimed: campaign.claimed
              };
            })
          );
          setCampaigns(fetchedCampaigns);
        } catch (error) {
          console.error('Error fetching campaigns:', error);
          setError('Failed to fetch campaigns');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchCampaigns();
  }, [contract, campaignCount]);

  const createCampaign = async () => {
    if (contract) {
      try {
        setLoading(true);
        const tx = await contract.create_campaign(
          uint256.bnToUint256(newCampaign.goal),
          newCampaign.deadline
        );
        await provider.waitForTransaction(tx.transaction_hash);
        const newCount = await contract.get_campaign_count();
        setCampaignCount(Number(newCount.toString()));
        setNewCampaign({ goal: '', deadline: '' });  // Reset form
      } catch (error) {
        console.error('Error creating campaign:', error);
        setError('Failed to create campaign');
      } finally {
        setLoading(false);
      }
    }
  };

  const contribute = async (campaignId) => {
    if (contract && contributionAmount) {
      try {
        setLoading(true);
        const tx = await contract.contribute(
          campaignId,
          uint256.bnToUint256(contributionAmount),
          { amount: contributionAmount }
        );
        await provider.waitForTransaction(tx.transaction_hash);
        // Refresh campaign data
        const updatedCampaign = await contract.get_campaign(campaignId);
        setCampaigns(campaigns.map(c => c.id === campaignId ? {
          ...c,
          amount_raised: uint256.uint256ToBN(updatedCampaign.amount_raised).toString()
        } : c));
      } catch (error) {
        console.error('Error contributing to campaign:', error);
        setError('Failed to contribute to campaign');
      } finally {
        setLoading(false);
      }
    }
  };

  const claimFunds = async (campaignId) => {
    if (contract) {
      try {
        setLoading(true);
        const tx = await contract.claim_funds(campaignId);
        await provider.waitForTransaction(tx.transaction_hash);
        const updatedCampaign = await contract.get_campaign(campaignId);
        setCampaigns(campaigns.map(c => c.id === campaignId ? { ...c, ...updatedCampaign } : c));
      } catch (error) {
        console.error('Error claiming funds:', error);
        setError('Failed to claim funds');
      } finally {
        setLoading(false);
      }
    }
  };

  const claimRefund = async (campaignId) => {
    if (contract) {
      try {
        setLoading(true);
        const tx = await contract.claim_refund(campaignId);
        await provider.waitForTransaction(tx.transaction_hash);
        const updatedCampaign = await contract.get_campaign(campaignId);
        setCampaigns(campaigns.map(c => c.id === campaignId ? { ...c, ...updatedCampaign } : c));
      } catch (error) {
        console.error('Error claiming refund:', error);
        setError('Failed to claim refund');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Crowdfunding Dapp</h1>
      
      {/* Create Campaign Form */}
      <div className="mb-8 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Create New Campaign</h2>
        <input
          type="number"
          placeholder="Goal (in wei)"
          value={newCampaign.goal}
          onChange={(e) => setNewCampaign({ ...newCampaign, goal: e.target.value })}
          className="mr-2 p-2 border rounded"
        />
        <input
          type="number"
          placeholder="Deadline (Unix timestamp)"
          value={newCampaign.deadline}
          onChange={(e) => setNewCampaign({ ...newCampaign, deadline: e.target.value })}
          className="mr-2 p-2 border rounded"
        />
        <button
          onClick={createCampaign}
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          Create Campaign
        </button>
      </div>
      
      {/* List of Campaigns */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Active Campaigns</h2>
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="mb-4 p-4 border rounded">
            <h3 className="text-xl font-semibold">Campaign #{campaign.id}</h3>
            <p>Creator: {campaign.creator}</p>
            <p>Goal: {campaign.goal.toString()} wei</p>
            <p>Raised: {campaign.amount_raised.toString()} wei</p>
            <p>Deadline: {new Date(campaign.deadline * 1000).toLocaleString()}</p>
            <p>Claimed: {campaign.claimed ? 'Yes' : 'No'}</p>
            <input
              type="number"
              placeholder="Contribution amount (in wei)"
              value={contributionAmount}
              onChange={(e) => setContributionAmount(e.target.value)}
              className="mr-2 p-2 border rounded"
            />
            <button
              onClick={() => contribute(campaign.id)}
              className="bg-green-500 text-white px-4 py-2 rounded mr-2"
              disabled={loading || !contributionAmount}
            >
              Contribute
            </button>
            <button
              onClick={() => claimFunds(campaign.id)}
              className="bg-yellow-500 text-white px-4 py-2 rounded mr-2"
              disabled={loading || campaign.creator !== account.address || campaign.claimed}
            >
              Claim Funds
            </button>
            <button
              onClick={() => claimRefund(campaign.id)}
              className="bg-red-500 text-white px-4 py-2 rounded"
              disabled={loading || campaign.claimed || new Date().getTime() / 1000 <= campaign.deadline}
            >
              Claim Refund
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Crowdfunding;