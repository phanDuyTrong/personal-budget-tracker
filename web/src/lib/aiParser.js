import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const aiService = {
    /**
     * Parses a natural language string into a structured transaction object.
     * @param {string} input - e.g., "Paid $50 for gas from Cash"
     * @param {Array} wallets - List of available wallets
     * @returns {Promise<Object>} - { amount, description, fromWalletId, toWalletId, category, type: 'expense'|'income'|'transfer' }
     */
    async parseTransaction(input, wallets) {
        if (!API_KEY) throw new Error("Gemini API Key is missing.");

        const walletNames = wallets.map(w => w.name).join(", ");

        // Prompt engineering for structured JSON output
        const prompt = `
      You are a financial assistant. transform the following natural language input into a structured JSON transaction.
      
      Input: "${input}"
      
      Available Wallets: ${walletNames}
      
      Rules:
      1. Detect if it is an 'expense', 'income', or 'transfer'.
      2. Extract 'amount' (number).
      3. Extract 'description' (string).
      4. Match 'fromWalletId' and 'toWalletId' (if transfer) to the closest matching Available Wallet name. If unsure, use null.
      5. Assign a 'mainCategory' (e.g., Food, Transport, Utilities) and 'subCategory' (e.g., Groceries, Taxi, Electric Bill).
      6. Extract 'person' if mentioned (e.g. "Dinner with John" -> person: "John"). If none, use null.
      
      Return ONLY valid JSON, no markdown formatting.
      Format:
      {
        "type": "expense",
        "amount": 50,
        "description": "gas",
        "mainCategory": "Transport",
        "subCategory": "Fuel",
        "person": null,
        "fromWalletName": "Cash",
        "toWalletName": null
      }
    `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            // Clean up markdown code blocks if present
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error("AI Parse Error:", error);
            throw new Error(`AI Parse Failed: ${error.message}`);
        }
    },

    /**
     * Generates a dashboard insight and chart recommendation based on transactions.
     * @param {Array} transactions 
     * @returns {Promise<Object>}
     */
    async getInsights(transactions) {
        if (!API_KEY) return null;
        if (transactions.length === 0) return null;

        // Summarize data to avoid token limits if necessary, but for now we send recent ones.
        const recentTx = transactions.slice(0, 50);
        const dataStr = JSON.stringify(recentTx.map(t => ({
            date: t.date,
            amount: t.amount,
            type: t.type,
            category: t.category
        })));

        const prompt = `
        Analyze these financial transactions and suggest ONE chart to visualize the health or a key trend.
        
        Transactions: ${dataStr}
        
        Return JSON:
        {
            "insight": "Your eating out expenses are higher than usual this week.",
            "chartType": "pie" | "bar" | "line",
            "chartData": [ ...data points for the chart... ],
            "chartTitle": "Spending by Category"
        }
    `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error("AI Insight Error:", error);
            return null; // Fail gracefully
        }
    }
};
