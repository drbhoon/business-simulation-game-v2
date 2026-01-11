
import { query } from '../db';

async function run() {
    console.log("Adding enhancement columns...");

    // 1. rm_bids: tm_bid_count
    try {
        await query(`ALTER TABLE rm_bids ADD COLUMN tm_bid_count INTEGER DEFAULT 0`);
        console.log("Added tm_bid_count to rm_bids");
    } catch (e: any) {
        if (e.message.includes('duplicate column')) console.log("tm_bid_count already exists");
        else console.log("Error adding tm_bid_count:", e.message);
    }

    // 2. financials: rm_spot_vol
    try {
        await query(`ALTER TABLE financials ADD COLUMN rm_spot_vol INTEGER DEFAULT 0`);
        console.log("Added rm_spot_vol to financials");
    } catch (e: any) {
        if (e.message.includes('duplicate column')) console.log("rm_spot_vol already exists");
        else console.log("Error adding rm_spot_vol:", e.message);
    }

    // 3. financials: rm_spot_cost_paise
    try {
        await query(`ALTER TABLE financials ADD COLUMN rm_spot_cost_paise BIGINT DEFAULT 0`);
        console.log("Added rm_spot_cost_paise to financials");
    } catch (e: any) {
        if (e.message.includes('duplicate column')) console.log("rm_spot_cost_paise already exists");
        else console.log("Error adding rm_spot_cost_paise:", e.message);
    }

    // 4. financials: cash_inflow_paise
    try {
        await query(`ALTER TABLE financials ADD COLUMN cash_inflow_paise BIGINT DEFAULT 0`);
        console.log("Added cash_inflow_paise to financials");
    } catch (e: any) {
        if (e.message.includes('duplicate column')) console.log("cash_inflow_paise already exists");
        else console.log("Error adding cash_inflow_paise:", e.message);
    }
    
    // 5. financials: tm_allocated_count (for history tracking if base_tm_count changes)
    // Actually base_tm_count is in teams, but effectively it's the allocated count.
    
    console.log("Schema update complete.");
    process.exit(0);
}

run();
