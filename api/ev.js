export default async function handler(req, res) {
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

    const {
        postal
    } = req.query;
    if (!postal || !/^\d{6}$/.test(postal)) {
        return res.status(400).json({
            error: 'Valid 6-digit postal code required'
        });
    }

    const url = `https://datamall2.mytransport.sg/ltaodataservice/EVChargingPoints?PostalCode=${postal}`;

    try {
        const ltaRes = await fetch(url, {
            headers: {
                AccountKey: LTA_KEY,
                accept: 'application/json',
            },
        });

        if (!ltaRes.ok) throw new Error(`LTA API error: ${ltaRes.status}`);
        const data = await ltaRes.json();

        // Cache for 4.5 minutes (just under 5-min update freq)
        res.setHeader('Cache-Control', 's-maxage=270, stale-while-revalidate=30');
        return res.status(200).json({
            value: data.value || [],
            count: (data.value || []).length
        });
    } catch (err) {
        console.error('EV API error:', err);
        return res.status(502).json({
            error: err.message
        });
    }
}