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

    try {
        // LTA DataMall paginates at $skip, fetch all pages
        let allValues = [];
        let skip = 0;
        const pageSize = 500;

        while (true) {
            const url = `https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2?$skip=${skip}`;
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
            const page = data.value || [];
            allValues = allValues.concat(page);

            if (page.length < pageSize) break;
            skip += pageSize;
        }

        // Cache for 55 seconds (API updates every 1 min)
        res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=5');
        return res.status(200).json({
            value: allValues
        });
    } catch (err) {
        console.error('Carpark API error:', err);
        return res.status(500).json({
            error: err.message
        });
    }
}