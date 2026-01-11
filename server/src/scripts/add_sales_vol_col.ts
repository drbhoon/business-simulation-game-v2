
import { query } from '../db';

async function run() {
    console.log("Adding sales_vol column...");
    try {
        await query(`ALTER TABLE financials ADD COLUMN sales_vol INTEGER DEFAULT 0`);
        console.log("Added sales_vol to financials");
    } catch (e: any) {
        if (e.message.includes('duplicate column')) console.log("sales_vol already exists");
        else console.log("Error adding sales_vol:", e.message);
    }
    process.exit(0);
}

run();
