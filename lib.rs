use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke};
use anchor_lang::solana_program::instruction::Instruction;
use std::collections::BTreeMap;

// Import the truth_network program
declare_program!(truth_network);
use truth_network::{ 
    program::TruthNetwork,
    cpi::accounts::HelloWorld,
    cpi::accounts::UpdateReward,
    cpi::hello_world,
    cpi::update_reward,
};

// Import the Truth-Network program
use truth_network::accounts::Question;

declare_id!("5ea8r7iuNh3R1FWGor9gWvYmXhqXBPdh1zK3cKgXwnEp");

#[program]
pub mod betting_contract {
    use super::*;

    /// CPI Call to `helloWorld` in Truth Network
    pub fn call_hello_world(ctx: Context<CallHelloWorld>) -> Result<()> {
        msg!("Calling HelloWorld function from Truth Network...");

        let cpi_program = ctx.accounts.truth_network_program.to_account_info();
        let cpi_accounts = HelloWorld {
            user: ctx.accounts.user.to_account_info(),
        };
        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

        truth_network::cpi::hello_world(cpi_context)?;

        msg!("Successfully called HelloWorld in Truth Network!");
        Ok(())
    }

    /// Create Betting Question (References the Truth-Network Question)
    pub fn create_betting_question(
        ctx: Context<CreateBettingQuestion>,
        title: String,
        close_date: i64,
        reward_date: i64,
    ) -> Result<()> {
        let betting_question = &mut ctx.accounts.betting_question;

        msg!("Creating Betting Question...");
        msg!("Title: {}", title);
        msg!("Received Truth-Network Question PDA: {}", ctx.accounts.question_pda.key());

        // Store betting question details
        betting_question.creator = *ctx.accounts.creator.key;
        betting_question.title = title;
        betting_question.question_pda = *ctx.accounts.question_pda.key;
        betting_question.option1 = "Yes".to_string();
        betting_question.option2 = "No".to_string();
        betting_question.total_bets_option1 = 0;
        betting_question.total_bets_option2 = 0;
        betting_question.total_pool = 0;
        betting_question.total_creator_commission = 0;
        betting_question.total_house_commision = 0;
        betting_question.close_date = close_date;
        betting_question.reward_date = reward_date;
        betting_question.status = "open".to_string();
        betting_question.result = None;

        msg!("Betting Question Created Successfully!");
        msg!("Stored Truth-Network Question PDA: {}", betting_question.question_pda);

        Ok(())
    }


    /// Function to place a bet on a question
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        amount: u64,
        is_option_1: bool
    ) -> Result<()> {
        let betting_question = &mut ctx.accounts.betting_question;

        // Ensure betting is still open
        let current_time = Clock::get()?.unix_timestamp;
        require!(current_time < betting_question.close_date, BettingError::BettingClosed);

        // Update total bets
        if is_option_1 {
            betting_question.total_bets_option1 += amount;
        } else {
            betting_question.total_bets_option2 += amount;
        }
        betting_question.total_pool += amount;

        // Store bettor details in BettingQuestion (inside bettors Vec)
        betting_question.bettors.push(BettorRecord {
            address: *ctx.accounts.user.key,
            chosen_option: is_option_1,
            bet_amount: amount,
        });

        // Calculate new reward (1% of total pool)
        let new_reward = betting_question.total_pool * 1 / 100;

        // Call Truth-Network to update reward via CPI
        let cpi_accounts = UpdateReward {
            question: ctx.accounts.truth_network_question.to_account_info(),
            updater: ctx.accounts.bet_program.to_account_info(),
        };
        let cpi_context = CpiContext::new(ctx.accounts.truth_network_program.to_account_info(), cpi_accounts);
        update_reward(cpi_context, new_reward)?;
    
        Ok(())
    }

    pub fn check_betting_question(ctx: Context<CheckBettingQuestion>) -> Result<()> {
        let betting_question = &ctx.accounts.betting_question;
        msg!("Betting Question Exists: {}", betting_question.title);
        Ok(())
    }

}



/// Betting Question Struct (Linked to Truth-Network Question)
#[account]
pub struct BettingQuestion {
    pub question_pda: Pubkey, // Reference to Truth-Network Question
    pub creator: Pubkey,
    pub title: String,
    pub option1: String,
    pub option2: String,
    pub total_bets_option1: u64,
    pub total_bets_option2: u64,
    pub total_pool: u64,
    pub total_creator_commission: u64,
    pub total_house_commision: u64,
    pub bettors: Vec<BettorRecord>,
    pub close_date: i64,
    pub reward_date: i64,
    pub status: String,  // "open", "closed", "resolved"
    pub result: Option<String>,
}

/// Account Structs
#[derive(Accounts)]
pub struct CallHelloWorld<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub truth_network_program: Program<'info, TruthNetwork>,
}

#[derive(Accounts)]
pub struct CreateBettingQuestion<'info> {
    #[account(
        init,
        payer = creator,
        space = 800,
        seeds = [b"betting_question", question_pda.key().as_ref()],
        bump
    )]
    pub betting_question: Account<'info, BettingQuestion>,

    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: This is a reference to the Truth-Network question.
    #[account(mut)]
    pub question_pda: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeHouseWallet<'info> {
    #[account(init, payer = creator, space = 8 + 8)]
    pub house_wallet: Account<'info, HouseWallet>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub betting_question: Account<'info, BettingQuestion>,
    #[account(mut)]
    pub user: Signer<'info>,

    //Truth-Network CPI Accounts
    #[account(mut)]
    pub truth_network_question: Account<'info, Question>,
    #[account(mut)]
    pub bet_program: Signer<'info>,
    pub truth_network_program: Program<'info, TruthNetwork>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct BettorRecord {
    pub address: Pubkey,
    pub chosen_option: bool,
    pub bet_amount: u64,
}


#[derive(Accounts)]
pub struct DistributeCommissions<'info> {
    #[account(mut)]
    pub betting_question: Account<'info, BettingQuestion>,
    #[account(mut)]
    pub house_wallet: Account<'info, HouseWallet>,
    #[account(mut)]
    pub creator: Signer<'info>
}

/// House Wallet Struct
#[account]
pub struct HouseWallet {
    pub total_funds: u64,
}

#[derive(Accounts)]
pub struct CheckBettingQuestion<'info> {
    #[account(mut)]
    pub betting_question: Account<'info, BettingQuestion>,
}

#[error_code]
pub enum BettingError {
    #[msg("Betting is now closed.")]
    BettingClosed,
}