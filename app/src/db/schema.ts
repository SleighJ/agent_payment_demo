/**
 * Database schema definitions
 */

export const CREATE_TABLES_SQL = `
  -- Users table: links Telegram users to the platform
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    telegram_username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Wallets table: stores Solana wallets for users and agents
  CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    public_key TEXT UNIQUE NOT NULL,
    encrypted_secret_key TEXT NOT NULL,
    wallet_type TEXT NOT NULL CHECK(wallet_type IN ('human', 'agent')),
    label TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Transactions table: records all transfers
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_wallet_id INTEGER NOT NULL,
    to_wallet_id INTEGER,
    to_external_address TEXT,
    amount REAL NOT NULL,
    token TEXT NOT NULL DEFAULT 'USDC',
    fee REAL DEFAULT 0,
    tx_signature TEXT,
    tx_type TEXT NOT NULL CHECK(tx_type IN ('transfer', 'withdrawal', 'deposit', 'fee')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    FOREIGN KEY (from_wallet_id) REFERENCES wallets(id),
    FOREIGN KEY (to_wallet_id) REFERENCES wallets(id)
  );

  -- Spending limits table: enforces daily caps
  CREATE TABLE IF NOT EXISTS spending_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id INTEGER UNIQUE NOT NULL,
    daily_limit REAL NOT NULL DEFAULT 1000,
    used_today REAL NOT NULL DEFAULT 0,
    reset_date DATE NOT NULL DEFAULT (DATE('now')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id)
  );

  -- Withdrawal requests table: tracks fiat off-ramp requests
  CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    wallet_id INTEGER NOT NULL,
    amount_usdc REAL NOT NULL,
    amount_fiat REAL,
    fiat_currency TEXT DEFAULT 'USD',
    stripe_transfer_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (wallet_id) REFERENCES wallets(id)
  );

  -- Create indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
  CREATE INDEX IF NOT EXISTS idx_wallets_public_key ON wallets(public_key);
  CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON transactions(from_wallet_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet ON transactions(to_wallet_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_spending_limits_wallet ON spending_limits(wallet_id);
`;

// TypeScript interfaces for type safety
export interface User {
  id: number;
  telegram_id: string;
  telegram_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: number;
  user_id: number;
  public_key: string;
  encrypted_secret_key: string;
  wallet_type: 'human' | 'agent';
  label: string | null;
  is_active: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  from_wallet_id: number;
  to_wallet_id: number | null;
  to_external_address: string | null;
  amount: number;
  token: string;
  fee: number;
  tx_signature: string | null;
  tx_type: 'transfer' | 'withdrawal' | 'deposit' | 'fee';
  status: 'pending' | 'confirmed' | 'failed';
  error_message: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface SpendingLimit {
  id: number;
  wallet_id: number;
  daily_limit: number;
  used_today: number;
  reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface WithdrawalRequest {
  id: number;
  user_id: number;
  wallet_id: number;
  amount_usdc: number;
  amount_fiat: number | null;
  fiat_currency: string;
  stripe_transfer_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

