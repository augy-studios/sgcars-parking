export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const {
        q
    } = req.query;
    if (!q) return res.status(400).json({
        error: 'Missing query parameter q'
    });

    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Singapore')}&format=json&limit=5&countrycodes=sg`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SGCarParking/1.0 (sgcars.uwuapps.org)'
            }
        });

        if (!response.ok) throw new Error('Geocoding failed');
        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}