export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({
        error: 'Method not allowed'
    });

    const LTA_KEY = process.env.LTA_ACCOUNT_KEY;
    if (!LTA_KEY) return res.status(500).json({
        error: 'LTA API key not configured'
    });

    const url = 'https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2';

    try {
        let all = [];
        let skip = 0;
        const pageSize = 500;

        // Paginate through all results (LTA returns max 500 per call)
        while (true) {
            const fetchUrl = skip > 0 ? `${url}?$skip=${skip}` : url;
            const ltaRes = await fetch(fetchUrl, {
                headers: {
                    AccountKey: LTA_KEY,
                    accept: 'application/json',
                },
            });

            if (!ltaRes.ok) throw new Error(`LTA API error: ${ltaRes.status}`);
            const data = await ltaRes.json();
            const batch = data.value || [];
            all = all.concat(batch);

            if (batch.length < pageSize) break;
            skip += pageSize;
            if (skip > 10000) break; // safety cap
        }

        // Cache for 50 seconds (just under 1-min update freq)
        res.setHeader('Cache-Control', 's-maxage=50, stale-while-revalidate=10');
        return res.status(200).json({
            value: all,
            count: all.length
        });
    } catch (err) {
        console.error('Carpark API error:', err);
        return res.status(502).json({
            error: err.message
        });
    }
}