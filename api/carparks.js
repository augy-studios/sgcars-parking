export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const apiKey = process.env.LTA_ACCOUNT_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'LTA API key not configured'
        });
    }

    try {
        let allRecords = [];
        let skip = 0;
        const batchSize = 500;

        while (true) {
            const url = `https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2?$skip=${skip}`;
            const response = await fetch(url, {
                headers: {
                    'AccountKey': apiKey,
                    'accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`LTA API error: ${response.status}`);
            }

            const data = await response.json();
            const records = data.value || [];

            if (records.length === 0) break;

            allRecords = allRecords.concat(records);

            if (records.length < batchSize) break;
            skip += batchSize;
        }

        res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=5');
        return res.status(200).json({
            value: allRecords,
            timestamp: new Date().toISOString(),
            total: allRecords.length
        });
    } catch (err) {
        console.error('Carpark API error:', err);
        return res.status(500).json({
            error: err.message
        });
    }
}