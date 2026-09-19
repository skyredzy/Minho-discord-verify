# Minho Discord Verify

Discord OAuth2 verification web app.

## Environment variables

- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET
- DISCORD_BOT_TOKEN
- DISCORD_GUILD_ID
- DISCORD_VERIFIED_ROLE_ID
- SESSION_SECRET
- BASE_URL

Set `BASE_URL` to the public Railway URL, without a trailing slash.

OAuth2 Redirect URI:
`BASE_URL/callback`

The Discord bot needs **Manage Roles**, and the bot's role must be above the **Verified** role.