export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const apiKey = process.env.LTA_ACCOUNT_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'LTA_ACCOUNT_KEY not configured'
        });
    }

    const {
        postalCode
    } = req.query;
    if (!postalCode) {
        return res.status(400).json({
            error: 'postalCode query parameter is required'
        });
    }

    // Sanitise: Singapore postal codes are 6 digits
    const clean = String(postalCode).replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) {
        return res.status(400).json({
            error: 'Invalid postal code format'
        });
    }

    try {
        const url = `https://datamall2.mytransport.sg/ltaodataservice/EVChargingPoints?PostalCode=${clean}`;
        const resp = await fetch(url, {
            headers: {
                AccountKey: apiKey,
                accept: 'application/json',
            },
        });

        if (!resp.ok) {
            const text = await resp.text();
            return res.status(resp.status).json({
                error: 'LTA API error',
                detail: text
            });
        }

        const data = await resp.json();

        // Cache for 4.5 minutes (API updates every 5 min)
        res.setHeader('Cache-Control', 's-maxage=270, stale-while-revalidate=30');
        return res.status(200).json({
            value: data.value || []
        });
    } catch (err) {
        console.error('EV API error:', err);
        return res.status(500).json({
            error: err.message
        });
    }
}