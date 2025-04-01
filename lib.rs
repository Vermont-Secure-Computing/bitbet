use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, program::invoke_signed};
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::system_program;
use anchor_lang::solana_program::rent::Rent;
use std::str::FromStr;

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

pub const HOUSE_WALLET: &str = "6tBwNgSW17jiWoEuoGEyqwwH3Jkv86WN61FETFoHonof";

declare_id!("EXTe4WJaQHyKew4TWKRPorMenPjbeYdhsXQpypS3oECT");

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
    ) -> Result<()> {
        let betting_question = &mut ctx.accounts.betting_question;
        let vault = &mut ctx.accounts.vault;

        let current_timestamp = Clock::get()?.unix_timestamp;

        // Ensure close_date is in the future
        require!(
            close_date > current_timestamp,
            BettingError::InvalidCloseDate
        );

        // Ensure the title has greater than or equal to 10 and less than or equal to 150 characters
        require!(
            (10..=150).contains(&title.len()),
            BettingError::InvalidTitleLength
        );

        msg!("Creating Betting Question...");
        msg!("Title: {}", title);
        msg!("Received Truth-Network Question PDA: {}", ctx.accounts.question_pda.key());

        // Store betting question details
        betting_question.id = betting_question.key();
        betting_question.creator = *ctx.accounts.creator.key;
        betting_question.title = title;
        betting_question.question_pda = *ctx.accounts.question_pda.key;
        betting_question.option1 = "True".to_string();
        betting_question.option2 = "False".to_string();
        betting_question.total_bets_option1 = 0;
        betting_question.total_bets_option2 = 0;
        betting_question.total_pool = 0;
        betting_question.total_creator_commission = 0;
        betting_question.total_house_commision = 0;
        betting_question.close_date = close_date;
        betting_question.status = "open".to_string();
        betting_question.result = None;
        betting_question.vault = vault.key(); // This will store Vault PDA in BettingQuestion
        betting_question.house_commission_claimed = false;
        betting_question.creator_commission_claimed = false;

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

        // Ensure bet amount is at least 0.1 SOL (minimum bet)
        require!(
            amount >= 100_000_000, // 0.1 SOL in lamports
            BettingError::MinimumBetNotMet
        );

        let bump = ctx.bumps.bettor_account;

        msg!("Bettor PDA: {}", ctx.accounts.bettor_account.key());
        msg!("Bettor Exists?: {}", ctx.accounts.bettor_account.bettor_address != Pubkey::default());

        if ctx.accounts.bettor_account.bettor_address == Pubkey::default() {
            msg!("Initializing new Bettor Account...");
            ctx.accounts.bettor_account.bettor_address = *user.key;
            ctx.accounts.bettor_account.question_pda = betting_question.key();
            ctx.accounts.bettor_account.chosen_option = is_option_1;
            ctx.accounts.bettor_account.bet_amount = 0;
            ctx.accounts.bettor_account.won = false;
            ctx.accounts.bettor_account.winnings = 0;
            ctx.accounts.bettor_account.claimed = false;
        }

        // Update bet amount
        ctx.accounts.bettor_account.bet_amount += amount;

        msg!("Bettor {} placed a bet of {} on option {}", user.key(), amount, is_option_1);

    
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
            betting_question.option1_odds = betting_question.total_pool as f64 / betting_question.total_bets_option1 as f64;
            betting_question.option2_odds = betting_question.total_pool as f64 / betting_question.total_bets_option2 as f64;
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
            //vault: ctx.accounts.truth_network_vault.to_account_info(), 
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
        let house_wallet = &ctx.accounts.house_wallet;
        let vault = &ctx.accounts.vault;


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
        msg!("Called finalize_voting on Truth-Network for Question ID: {}", question_id);

        // Step 2: Manually Re-fetch the Truth-Network Question
        let account_info = truth_network_question.to_account_info();
        let latest_data = &mut account_info.try_borrow_mut_data()?;
        let truth_network_question: Question = Question::try_deserialize(&mut latest_data.as_ref())?;
    
        // Step 3: Fetch winner details from Truth-Network
        let winner = truth_network_question.winning_option;
        let winning_percentage = truth_network_question.winning_percent;

        msg!("winning option: {}", winner);
        msg!("winning percent: {}", winning_percentage);
    
        require!(winner == 1 || winner == 2, BettingError::InvalidWinner);
    
        // Step 4: Update betting question result
        betting_question.winner = winner;
        betting_question.winning_percentage = winning_percentage;
        betting_question.status = "close".to_string();
    
        msg!("Winner Fetched & Stored: Option {} ({}%)", winner, winning_percentage);
    
        // Step 5: Compute Winning Odds
        let winning_odds = if winner == 1 {
            betting_question.option1_odds
        } else {
            betting_question.option2_odds
        };
    
        msg!("Winning Option: {}", if winner == 1 { "Option 1" } else { "Option 2" });
        msg!("Winning Odds: {}", winning_odds);


        // Step 6: Transfer House Commission if Not Yet Claimed
        if !betting_question.house_commission_claimed {
            let house_commission = betting_question.total_house_commision;
            require!(house_commission > 0, BettingError::NoCommissionAvailable);

            msg!(
                "Transferring {} lamports to House Wallet: {}",
                house_commission,
                house_wallet.key()
            );
    
            // Use SystemProgram to Transfer Funds
            let transfer_instruction = system_instruction::transfer(
                &vault.key(),
                &house_wallet.key(),
                house_commission,
            );
    
            invoke(
                &transfer_instruction,
                &[
                    vault.to_account_info(),
                    house_wallet.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
    
            // Mark commission as claimed
            betting_question.house_commission_claimed = true;

        } else {
            msg!("House commission already claimed.");
        }
        
    
        Ok(())
    }


    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let betting_question = &ctx.accounts.betting_question;
        let truth_network_question = &ctx.accounts.truth_network_question;
        let bettor_account = &mut ctx.accounts.bettor_account;
        let user = &ctx.accounts.user;
        let vault = &mut ctx.accounts.vault; // Betting Vault
    
        msg!("User {} is attempting to claim winnings", user.key());

        // Ensure the bettor is the caller
        require!(
            bettor_account.bettor_address == *user.key,
            BettingError::UnauthorizedBettor
        );

        // Ensure the bet belongs to the correct question
        require!(
            bettor_account.question_pda == betting_question.key(),
            BettingError::InvalidBettingQuestion
        );
    
        // Check if the user has already claimed winnings
        require!(!bettor_account.claimed, BettingError::AlreadyClaimed);
    
        // Check if betting has ended
        require!(
            Clock::get()?.unix_timestamp >= betting_question.close_date,
            BettingError::BettingActive
        );
    
        // Ensure Truth-Network question is finalized
        require!(
            truth_network_question.finalized,
            BettingError::WinnerNotFinalized
        );
    
        // Get the winning option from Truth-Network question
        let winning_option = truth_network_question.winning_option;
        let winning_percentage = truth_network_question.winning_percent;

        require!(winning_option == 1 || winning_option == 2, BettingError::InvalidWinner);
        
        msg!(
            "Winning option: {}, Winning percentage: {}%",
            winning_option,
            winning_percentage
        );
        

        // Case 1: If winning percentage is 75% or higher -> Only winners get winnings
        if winning_percentage >= 75.0 {
            // Check if the user placed a bet on the winning option
            let user_bet_won = (winning_option == 1 && bettor_account.chosen_option)
                || (winning_option == 2 && !bettor_account.chosen_option);
        
            require!(user_bet_won, BettingError::UserDidNotWin);
    
            // Compute winnings
            let winning_odds = if winning_option == 1 {
                betting_question.option1_odds
            } else {
                betting_question.option2_odds
            };
    
            let user_winnings = (bettor_account.bet_amount as f64 * winning_odds) as u64;
            require!(user_winnings > 0, BettingError::NoWinningsAvailable);
    
            // Check if vault has enough balance
            let vault_balance = vault.get_lamports();
            require!(vault_balance >= user_winnings, BettingError::InsufficientVaultBalance);
    
            msg!(
                "User won {} lamports. Transferring from vault {}...",
                user_winnings,
                vault.key()
            );
    
            // Transfer winnings from Vault to User
            {
                let vault_balance_before = vault.get_lamports();
                let user_balance_before = user.get_lamports();
        
                // Deduct from vault
                vault.sub_lamports(user_winnings)?;
        
                // Add to user
                user.add_lamports(user_winnings)?;
        
                let vault_balance_after = vault.get_lamports();
                let user_balance_after = user.get_lamports();
        
                require_eq!(vault_balance_after, vault_balance_before - user_winnings);
                require_eq!(user_balance_after, user_balance_before + user_winnings);
        
                msg!("Successfully transferred {} lamports to user {}!", user_winnings, user.key());
            }

            bettor_account.winnings = user_winnings;
            msg!("Claim successful! User {} received {} SOL", user.key(), user_winnings);
            
        } else {
            // Case 2: If winning percentage is below 75% -> Refund 97% of bet amount to all bettors
            let refund_amount = (bettor_account.bet_amount as f64 * 0.97) as u64;

            require!(refund_amount > 0, BettingError::NoWinningsAvailable);

            // Check if vault has enough balance
            let vault_balance = vault.get_lamports();
            require!(vault_balance >= refund_amount, BettingError::InsufficientVaultBalance);

            msg!(
                "Refunding {} lamports to user {}...",
                refund_amount,
                user.key()
            );

            // Transfer refund
            vault.sub_lamports(refund_amount)?;
            user.add_lamports(refund_amount)?;

            bettor_account.winnings = refund_amount;
            msg!("Refund successful! User {} received {} SOL", user.key(), refund_amount);

        }

        // Mark bettor winnings as claimed
        bettor_account.claimed = true;

        Ok(())
    }


    pub fn set_claim_tx_id(ctx: Context<SetClaimTxId>, tx_sig: String) -> Result<()> {
        let bettor = &mut ctx.accounts.bettor_account;
    
        let bytes = tx_sig.as_bytes();
        let len = bytes.len().min(88);
        bettor.claim_tx_id[..len].copy_from_slice(&bytes[..len]);
        for i in len..88 {
            bettor.claim_tx_id[i] = 0;
        }
    
        Ok(())
    }


    pub fn claim_creator_commission(ctx: Context<ClaimCreatorCommission>) -> Result<()> {
        let betting_question = &mut ctx.accounts.betting_question;
        let creator = &ctx.accounts.creator;
        let vault = &mut ctx.accounts.vault;
    
        msg!("Creator {} is attempting to claim commission", creator.key());
    
        require!(
            betting_question.creator == *creator.key,
            BettingError::UnauthorizedCreator
        );
    
        require!(
            Clock::get()?.unix_timestamp >= betting_question.close_date,
            BettingError::BettingActive
        );
    
        require!(!betting_question.creator_commission_claimed, BettingError::CommissionAlreadyClaimed);
        
        let commission_amount = betting_question.total_creator_commission;
        require!(commission_amount > 0, BettingError::NoCommissionAvailable);
    
        let vault_balance = vault.get_lamports();
        require!(vault_balance >= commission_amount, BettingError::InsufficientVaultBalance);
    
        msg!(
            "Transferring {} lamports to creator {}...",
            commission_amount,
            creator.key()
        );
    
        vault.sub_lamports(commission_amount)?;
        creator.add_lamports(commission_amount)?;
    
        // Mark as claimed
        betting_question.creator_commission_claimed = true;
    
        msg!("Creator commission of {} lamports claimed by {}", commission_amount, creator.key());
    
        Ok(())
    }
    
}


#[account]
pub struct Vault {} // PDA for holding bets SOL

/// Betting Question Struct (Linked to Truth-Network Question)
#[account]
pub struct BettingQuestion {
    pub id: Pubkey, // Betting question id
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
    pub close_date: i64,
    pub reward_date: i64,
    pub status: String, 
    pub result: Option<String>,
    pub winner: u8,
    pub winning_percentage: f64,
    pub vault: Pubkey,
    pub creator_commission_claimed: bool,
    pub house_commission_claimed: bool,
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
    #[account(
        init, 
        payer = creator, 
        space = 8 + 8
    )]
    pub house_wallet: Account<'info, HouseWallet>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub betting_question: Account<'info, BettingQuestion>,
    
    #[account(
        init_if_needed, 
        payer = user, 
        space = 8 + 179, 
        seeds = [b"bettor", user.key().as_ref(), betting_question.key().as_ref()], 
        bump)]
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


#[account]
pub struct BettorAccount {
    pub bettor_address: Pubkey,
    pub question_pda: Pubkey,
    pub chosen_option: bool,
    pub bet_amount: u64,
    pub won: bool,
    pub winnings: u64,
    pub claimed: bool,
    pub claim_tx_id: [u8; 88],
}


#[derive(Accounts)]
pub struct SetClaimTxId<'info> {
    #[account(mut, has_one = bettor_address)]
    pub bettor_account: Account<'info, BettorAccount>,

    /// CHECK: This is safe because we verify it matches `bettor_account.bettor_address` via `has_one`
    #[account(signer)]
    pub bettor_address: AccountInfo<'info>,
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

    /// CHECK: This is a fixed known address for the house wallet, no need for ownership verification.
    #[account(mut, address = HOUSE_WALLET.parse::<Pubkey>().unwrap())]
    pub house_wallet: AccountInfo<'info>,

    #[account(mut)]
    pub vault: Signer<'info>, 

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckBettingQuestion<'info> {
    #[account(mut)]
    pub betting_question: Account<'info, BettingQuestion>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub betting_question: Account<'info, BettingQuestion>,

    #[account(mut)]
    pub bettor_account: Account<'info, BettorAccount>,

    #[account(mut)]
    pub user: Signer<'info>, 

    #[account(mut)]
    pub truth_network_question: Account<'info, Question>,

    #[account(mut)]
    pub vault: Account<'info, Vault>, 

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct ClaimCreatorCommission<'info> {
    #[account(mut)]
    pub betting_question: Account<'info, BettingQuestion>,

    #[account(mut)]
    pub creator: Signer<'info>, 

    #[account(mut)]
    pub vault: Account<'info, Vault>, 

    pub system_program: Program<'info, System>,
}


#[error_code]
pub enum BettingError {

    #[msg("Betting is still active.")]
    BettingActive,

    #[msg("Betting is now closed.")]
    BettingClosed,

    #[msg("Invalid winning option.")]
    InvalidWinner,

    #[msg("Truth Network question not finalize.")]
    WinnerNotFinalized,

    #[msg("Winnings already claimed.")]
    AlreadyClaimed,

    #[msg("User did not win.")]
    UserDidNotWin,

    #[msg("Insufficient vault balance.")]
    InsufficientVaultBalance,

    #[msg("No winnings available..")]
    NoWinningsAvailable,

    #[msg("User is not authorized to claim winnings.")]
    UnauthorizedBettor,

    #[msg("Betting question mismatch.")]
    InvalidBettingQuestion,

    #[msg("No commission available to claim.")]
    NoCommissionAvailable,

    #[msg("Unathorized question creator.")]
    UnauthorizedCreator,

    #[msg("Commission already claimed.")]
    CommissionAlreadyClaimed,

    #[msg("Invalid close date. The close date must be in the future.")]
    InvalidCloseDate,

    #[msg("Invalid title length. Title must be between 10 and 150 characters.")]
    InvalidTitleLength,
    
    #[msg("Minimum bet is 0.1 SOL.")]
    MinimumBetNotMet,
}