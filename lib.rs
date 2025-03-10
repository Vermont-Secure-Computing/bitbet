use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, program::invoke_signed};
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::system_program;

// Import the truth_network program
declare_program!(truth_network);
use truth_network::{ 
    program::TruthNetwork,
    cpi::accounts::HelloWorld,
    cpi::accounts::UpdateReward,
    cpi::accounts::FinalizeVoting,
    cpi::hello_world,
    cpi::update_reward,
    cpi::finalize_voting,
};

// Import the Truth-Network program
use truth_network::accounts::Question;

declare_id!("HiF5DAmMR6HiZmhroFANvG8UajcMDydKPDbn4MD2qhRs");

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
        let vault = &mut ctx.accounts.vault;

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
        betting_question.vault = vault.key(); // This will store Vault PDA in BettingQuestion

        msg!("Betting Question Created Successfully!");
        msg!("Stored Truth-Network Question PDA: {}", betting_question.question_pda);
        msg!("Bet Vault PDA: {}", vault.key());

        Ok(())
    }

    /// Function to place a bet on a question
    pub fn place_bet(ctx: Context<PlaceBet>, amount: u64, is_option_1: bool) -> Result<()> {
        let betting_question = &mut ctx.accounts.betting_question;
        let user = &ctx.accounts.user;
        let vault = &mut ctx.accounts.vault; // Betting vault (owned by Betting Program)
        let truth_vault = &mut ctx.accounts.truth_network_vault; // Truth-Network vault (owned by Truth-Network)
    
        let system_program = &ctx.accounts.system_program;
    
        // Ensure betting is still open
        let current_time = Clock::get()?.unix_timestamp;
        require!(current_time < betting_question.close_date, BettingError::BettingClosed);
    
        // Deduct commissions
        let truth_network_commission = amount / 100;
        let house_commission = amount / 100;
        let creator_commission = amount / 100;
        let bet_after_commissions = amount - (truth_network_commission + house_commission + creator_commission);
    
        // Track total amount bet before deductions
        betting_question.total_bets_before_commission += amount;
    
        // Update total bets
        if is_option_1 {
            betting_question.total_bets_option1 += amount;
        } else {
            betting_question.total_bets_option2 += amount;
        }
        betting_question.total_pool += bet_after_commissions;
    
        // Store bettor details
        // betting_question.bettors.push(BettorRecord {
        //     address: *user.key,
        //     chosen_option: is_option_1,
        //     bet_amount: amount,
        //     won: false, // Default to false (will be updated later)
        //     winnings: 0, // Default to 0 (will be updated if they win)
        // });
        // // **Create BettorAccount**
        let bettor_account = &mut ctx.accounts.bettor_account;

        msg!("Initializing bettor account: {:?}", bettor_account.key());
        msg!("Bet Amount: {}", amount);
        msg!("User: {}", &ctx.accounts.user.key());
        msg!("Betting Question PDA: {}", betting_question.key());

        bettor_account.bettor_address = *user.key;
        bettor_account.question_pda = betting_question.key();
        bettor_account.chosen_option = is_option_1;
        bettor_account.bet_amount = amount;
        bettor_account.won = false; // Default false, updated after voting
        bettor_account.winnings = 0; // Default 0, updated if won
        msg!("Bettor Account Initialized");

    
        // Transfer the user's bet to the vault using System Program
        {
            let transfer_instruction = anchor_lang::system_program::transfer(
                CpiContext::new(
                    system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: user.to_account_info(),
                        to: vault.to_account_info(),
                    },
                ),
                amount,
            )?;
            msg!("User bet is transferred to the vault, amount: {}", amount);
        }
    
        // Transfer commission from Betting Vault to Truth-Network Vault
        {
            let vault_balance_before = vault.get_lamports();
            let truth_balance_before = truth_vault.get_lamports();
    
            // Subtract from betting vault
            vault.sub_lamports(truth_network_commission)?;
    
            // Add to truth network vault
            truth_vault.add_lamports(truth_network_commission)?;
    
            let vault_balance_after = vault.get_lamports();
            let truth_balance_after = truth_vault.get_lamports();
    
            require_eq!(vault_balance_after, vault_balance_before - truth_network_commission);
            require_eq!(truth_balance_after, truth_balance_before + truth_network_commission);
    
            msg!("Successfully transferred {} lamports to Truth-Network vault!", truth_network_commission);
        }
    
        // Compute odds
        if betting_question.total_bets_option1 > 0 && betting_question.total_bets_option2 > 0 {
            betting_question.option1_odds = betting_question.total_bets_before_commission as f64 / betting_question.total_bets_option1 as f64;
            betting_question.option2_odds = betting_question.total_bets_before_commission as f64 / betting_question.total_bets_option2 as f64;
        } else {
            betting_question.option1_odds = 0.0;
            betting_question.option2_odds = 0.0;
        }
    
        // Update total commission fields
        betting_question.total_creator_commission += creator_commission;
        betting_question.total_house_commision += house_commission;
    
        // Call Truth-Network to update reward via CPI
        let cpi_accounts = UpdateReward {
            question: ctx.accounts.truth_network_question.to_account_info(),
            updater: ctx.accounts.bet_program.to_account_info(),
        };
        let cpi_context = CpiContext::new(ctx.accounts.truth_network_program.to_account_info(), cpi_accounts);
        update_reward(cpi_context, truth_network_commission)?;
        msg!("Truth network question rewards updated with {}", truth_network_commission);
    
        Ok(())
    }
    
    
    pub fn check_betting_question(ctx: Context<CheckBettingQuestion>) -> Result<()> {
        let betting_question = &ctx.accounts.betting_question;
        msg!("Betting Question Exists: {}", betting_question.title);
        Ok(())
    }

    pub fn fetch_and_store_winner(ctx: Context<FetchAndStoreWinner>, question_id: u64) -> Result<()> {
        let betting_question = &mut ctx.accounts.betting_question;
        let truth_network_question = &ctx.accounts.truth_network_question;

        // Ensure betting is still open
        let current_time = Clock::get()?.unix_timestamp;
        require!(current_time > betting_question.close_date, BettingError::BettingActive);
    
        msg!("Fetching winner from Truth Network...");
    
        // Step 1: Call 'finalize_voting' on Truth-Network contract
        {
            let cpi_accounts = FinalizeVoting {
                question: truth_network_question.to_account_info(),
            };
    
            let cpi_context = CpiContext::new(ctx.accounts.truth_network_program.to_account_info(), cpi_accounts);
            finalize_voting(cpi_context, question_id)?;
        }
        
        msg!("Called finalize_voting on Truth-Network for Question ID: {}", question_id);
    
        // Step 2: Fetch winner details from Truth-Network
        let winner = truth_network_question.winning_option;
        let winning_percentage = truth_network_question.winning_percent;

        msg!("winning option: {}", winner);
        msg!("winning percent: {}", winning_percentage);
    
        require!(winner == 1 || winner == 2, BettingError::InvalidWinner);
    
        // Step 3: Update betting question result
        betting_question.winner = winner;
        betting_question.winning_percentage = winning_percentage;
    
        msg!("Winner Fetched & Stored: Option {} ({}%)", winner, winning_percentage);
    
        // Step 4: Compute Winning Odds
        let winning_odds = if winner == 1 {
            betting_question.option1_odds
        } else {
            betting_question.option2_odds
        };
    
        msg!("Winning Option: {}", if winner == 1 { "Option 1" } else { "Option 2" });
        msg!("Winning Odds: {}", winning_odds);
    
        // // Step 5: Process Bettors One at a Time
        // for bettor in ctx.remaining_accounts.iter() {
        //     let bettor_info = bettor.to_account_info(); // Get AccountInfo
        //     let mut bettor_account = Account::<BettorAccount>::try_from(&bettor_info)?;
    
        //     if (winner == 1 && bettor_account.chosen_option)
        //         || (winner == 2 && !bettor_account.chosen_option) {
    
        //         let odds = if winner == 1 {
        //             betting_question.option1_odds
        //         } else {
        //             betting_question.option2_odds
        //         };
    
        //         bettor_account.won = true;
        //         bettor_account.winnings = (bettor_account.bet_amount as f64 * odds) as u64;
        //     } else {
        //         bettor_account.won = false;
        //         bettor_account.winnings = 0;
        //     }
        // }
    
        Ok(())
    }
    
    
    

}


#[account]
pub struct Vault {} // PDA for holding bets SOL

/// Betting Question Struct (Linked to Truth-Network Question)
#[account]
pub struct BettingQuestion {
    pub question_pda: Pubkey, // Reference to Truth-Network Question
    pub creator: Pubkey,
    pub title: String,
    pub option1: String,
    pub option2: String,
    pub option1_odds: f64,
    pub option2_odds: f64,
    pub total_bets_option1: u64,
    pub total_bets_option2: u64,
    pub total_bets_before_commission: u64,
    pub total_pool: u64,
    pub total_creator_commission: u64,
    pub total_house_commision: u64,
    //pub bettors: Vec<BettorRecord>,
    pub close_date: i64,
    pub reward_date: i64,
    pub status: String,  // "open", "closed", "resolved"
    pub result: Option<String>,
    pub winner: u8, // 1 = option1, 2 = option2, 0 = draw
    pub winning_percentage: f64, // Percentage of winning votes (0-100)
    pub vault: Pubkey,
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
        seeds = [b"betting_question", betting_contract.key().as_ref(), question_pda.key().as_ref()],
        bump
    )]
    pub betting_question: Account<'info, BettingQuestion>,

    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: This is a reference to the Truth-Network question.
    #[account(mut)]
    pub question_pda: AccountInfo<'info>,

    /// CHECK: Betting Contract Program ID
    #[account(address = crate::ID)]
    pub betting_contract: AccountInfo<'info>,

    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"bet_vault", betting_question.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

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

    #[account(init, payer = user, space = 8 + 82, seeds = [b"bettor", user.key().as_ref(), betting_question.key().as_ref()], bump)]
    pub bettor_account: Account<'info, BettorAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// Betting Vault (For holding bets)
    #[account(mut)]
    pub vault: Account<'info, Vault>,

    //Truth-Network CPI Accounts
    #[account(mut)]
    pub truth_network_question: Account<'info, Question>,
    
    /// CHECK: This is the betting contract's program ID, used for CPIs. No validation required.
    pub bet_program: UncheckedAccount<'info>,
    
    pub truth_network_program: Program<'info, TruthNetwork>,
    pub system_program: Program<'info, System>,

    /// CHECK: Add Truth-Network Vault as a mutable account
    #[account(mut)]
    pub truth_network_vault: UncheckedAccount<'info>,
}


// #[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
// pub struct BettorRecord {
//     pub address: Pubkey,
//     pub chosen_option: bool,
//     pub bet_amount: u64,
//     pub won: bool,      // Track if bettor won
//     pub winnings: u64,  // Store winnings amount 
// }

#[account]
pub struct BettorAccount {
    pub bettor_address: Pubkey,
    pub question_pda: Pubkey,
    pub chosen_option: bool,
    pub bet_amount: u64,
    pub won: bool,
    pub winnings: u64,
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
pub struct FetchAndStoreWinner<'info> {
    #[account(mut)]
    pub betting_question: Account<'info, BettingQuestion>,

    /// CHECK: This is the question account from Truth Network.
    #[account(mut)]
    pub truth_network_question: Account<'info, Question>,

    pub truth_network_program: Program<'info, TruthNetwork>,
}

#[derive(Accounts)]
pub struct CheckBettingQuestion<'info> {
    #[account(mut)]
    pub betting_question: Account<'info, BettingQuestion>,
}

#[error_code]
pub enum BettingError {
    #[msg("Betting is still active.")]
    BettingActive,
    #[msg("Betting is now closed.")]
    BettingClosed,
    #[msg("Invalid winning option.")]
    InvalidWinner,
}