const path = require('path');
require('node:process').loadEnvFile(path.join(__dirname, '.env'));
const fs = require('fs').promises;
var package = require('./package.json');
var martStats = require('./martStats.json');

async function updateMartStats(field, value) {
    const file = path.resolve(__dirname, 'martStats.json');
    const raw = await fs.readFile(file, 'utf8');
    var stats = JSON.parse(raw);
    stats[field] = (field === 'totalSent') ? (stats.totalSent || 0) + 1 : value;
    await fs.writeFile(file, JSON.stringify(stats, null, 2), 'utf8');
    delete require.cache[require.resolve('./martStats.json')];
    martStats = require('./martStats.json');
};

async function sendWebhook(params) {
    for (var attempt = 0; attempt <= 3; attempt++) {
        const webhook = await fetch(`${process.env.DISCORD_WEBHOOK_URL}?with_components=true`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        }).catch(err => { throw err; });
        if (webhook.ok) return;
        if (webhook.status === 429) {
            const retryAfter = webhook.headers.get('retry-after');
            const wait = retryAfter ? (isNaN(Number(retryAfter)) ? (parseFloat(retryAfter) * 1000) : (Number(retryAfter) * 1000)) : 5000;
            await delay(wait);
            continue;
        };
        if (webhook.status >= 500 && attempt < 3) {
            await delay(1000 * Math.pow(2, attempt));
            continue;
        };
        const txt = await webhook.text().catch(() => '');
        console.error('Webhook failed:', JSON.stringify(params));
        throw new Error(`Webhook failed: ${webhook.status} ${webhook.statusText} ${txt}`);
    };
    throw new Error('Webhook failed to be sent');
};

async function redTieReminders() {
    try {
        if (new Date(martStats.lastSent).toDateString() === new Date().toDateString()) return;
        lastSentDateSent = new Date();
        await sendWebhook({
            "username": "Red Tie Reminders",
            "avatar_url": "https://faisaln.com/Red-Tie-Reminders.png",
            "content": process.env.DISCORD_ROLE || '',
            "embeds": [{
                color: parseInt('d6001c', 16),
                title: `${process.env.DISCORD_EMOJI ? `${process.env.DISCORD_EMOJI} ` : ''}Wear your red tie tomorrow!`,
                description: `This is your weekly reminder to wear your red tie tomorrow for Red Tie Tuesday!`,
                footer: {
                    text: `Red Tie Reminders v${package.version} • ${martStats.totalSent + 1} Red Tie Reminder${((martStats.totalSent + 1) > 1) ? 's' : ''} Sent`,
                    icon_url: 'https://faisaln.com/Red-Tie-Reminders.png',
                },
                timestamp: lastSentDateSent.toISOString(),
            }],
            "components": [
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 2,
                            "style": 5,
                            "emoji": process.env.DISCORD_EMOJI ? {
                                "id": process.env.DISCORD_EMOJI.split(':')[2].replace('>', ''),
                                "name": process.env.DISCORD_EMOJI.split(':')[1]
                            } : {
                                "name": "🧑‍💻"
                            },
                            "url": "https://faisaln.com/scripts/red-tie-reminders"
                        }
                    ],
                }
            ],
        });
        await updateMartStats('totalSent', 1);
        console.log(`Sent Red Tie Reminder #${martStats.totalSent} @ ${lastSentDateSent}`);
        await updateMartStats('lastSent', lastSentDateSent.toISOString());
    } catch (error) {
        console.error("Error in redTieReminders:", error);
    };
};

redTieReminders();