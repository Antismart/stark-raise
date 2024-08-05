use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store, Clone)]
struct Campaign {
    creator: ContractAddress,
    goal: u128,  // Now treated as a single u128
    deadline: u64,
    amount_raised: u128,
    claimed: bool,
}

#[starknet::interface]
trait ICrowdfunding<TContractState> {
    fn create_campaign(ref self: TContractState, goal: u128, deadline: u64);
    fn contribute(ref self: TContractState, campaign_id: u32);
    fn claim_funds(ref self: TContractState, campaign_id: u32);
    fn claim_refund(ref self: TContractState, campaign_id: u32);
    fn get_campaign(self: @TContractState, campaign_id: u32) -> Campaign;
    fn get_contribution(self: @TContractState, campaign_id: u32, contributor: ContractAddress) -> u128;
    fn get_campaign_count(self: @TContractState) -> u32;
}

#[starknet::contract]
mod Crowdfunding {
    use super::{Campaign, ICrowdfunding};
    use starknet::{get_caller_address, ContractAddress, get_block_timestamp};

    #[storage]
    struct Storage {
        campaigns: LegacyMap::<u32, Campaign>,
        campaign_count: u32,
        contributions: LegacyMap::<(u32, ContractAddress), u128>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        CampaignCreated: CampaignCreated,
        ContributionMade: ContributionMade,
        GoalReached: GoalReached,
        FundsClaimed: FundsClaimed,
        RefundClaimed: RefundClaimed,
    }

    #[derive(Drop, starknet::Event)]
    struct CampaignCreated {
        id: u32,
        creator: ContractAddress,
        goal: u128,
        deadline: u64
    }

    #[derive(Drop, starknet::Event)]
    struct ContributionMade {
        campaign_id: u32,
        contributor: ContractAddress,
        amount: u128
    }

    #[derive(Drop, starknet::Event)]
    struct GoalReached {
        campaign_id: u32,
        total_raised: u128
    }

    #[derive(Drop, starknet::Event)]
    struct FundsClaimed {
        campaign_id: u32,
        amount: u128
    }

    #[derive(Drop, starknet::Event)]
    struct RefundClaimed {
        campaign_id: u32,
        contributor: ContractAddress,
        amount: u128
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.campaign_count.write(0);
    }

    #[abi(embed_v0)]
    impl CrowdfundingImpl of ICrowdfunding<ContractState> {
        fn create_campaign(ref self: ContractState, goal: u128, deadline: u64) {
            let creator = starknet::get_caller_address();
            let campaign_id = self.campaign_count.read() + 1;
            
            self.campaigns.write(campaign_id, Campaign {
                creator,
                goal,
                deadline,
                amount_raised: 0,  // Initialize as 0
                claimed: false,
            });

            self.campaign_count.write(campaign_id);
            self.emit(Event::CampaignCreated(CampaignCreated { id: campaign_id, creator, goal, deadline }));
        }

        fn contribute(ref self: ContractState, campaign_id: u32) {
            let caller = starknet::get_caller_address();
            let amount = starknet::get_tx_info().unbox().max_fee;  // Assume this is a u128
            let mut campaign = self.campaigns.read(campaign_id);
            
            assert!(starknet::get_block_timestamp() <= campaign.deadline, "Campaign ended");

            let new_amount_raised = campaign.amount_raised + amount;
            campaign.amount_raised = new_amount_raised;
            self.campaigns.write(campaign_id, campaign.clone());

            let current_contribution = self.contributions.read((campaign_id, caller));
            let new_contribution = current_contribution + amount;
            self.contributions.write((campaign_id, caller), new_contribution);

            self.emit(Event::ContributionMade(ContributionMade { campaign_id, contributor: caller, amount }));

            if new_amount_raised >= campaign.goal {
                self.emit(Event::GoalReached(GoalReached { campaign_id, total_raised: new_amount_raised }));
            }
        }

        fn claim_funds(ref self: ContractState, campaign_id: u32) {
            let mut campaign = self.campaigns.read(campaign_id);
            assert!(starknet::get_caller_address() == campaign.creator, "Only creator can claim");
            assert!(campaign.amount_raised >= campaign.goal, "Goal not reached");
            assert!(!campaign.claimed, "Funds already claimed");

            campaign.claimed = true;
            self.campaigns.write(campaign_id, campaign.clone());

            self.emit(Event::FundsClaimed(FundsClaimed { campaign_id, amount: campaign.amount_raised }));
        }

        fn claim_refund(ref self: ContractState, campaign_id: u32) {
            let campaign = self.campaigns.read(campaign_id);
            assert!(starknet::get_block_timestamp() > campaign.deadline, "Campaign not ended");
            assert!(campaign.amount_raised < campaign.goal, "Goal was reached");

            let caller = starknet::get_caller_address();
            let contribution = self.contributions.read((campaign_id, caller));
            assert!(contribution > 0, "No contribution found");

            self.contributions.write((campaign_id, caller), 0);

            self.emit(Event::RefundClaimed(RefundClaimed { campaign_id, contributor: caller, amount: contribution }));
        }

        fn get_campaign(self: @ContractState, campaign_id: u32) -> Campaign {
            self.campaigns.read(campaign_id)
        }

        fn get_contribution(self: @ContractState, campaign_id: u32, contributor: ContractAddress) -> u128 {
            self.contributions.read((campaign_id, contributor))
        }

        fn get_campaign_count(self: @ContractState) -> u32 {
            self.campaign_count.read()
        }
    }
}

