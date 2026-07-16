const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to acquire Graph token: ${res.status} ${body}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function graphFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(`Graph API error ${res.status}: ${data ? JSON.stringify(data.error || data) : res.statusText}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

async function getUserEmail(userId) {
  try {
    const user = await graphFetch(`/users/${userId}?$select=mail,userPrincipalName`);
    return (user.mail || user.userPrincipalName || '').toLowerCase() || null;
  } catch {
    return null;
  }
}

async function getChannelMessages(teamId, channelId) {
  const encodedChannelId = encodeURIComponent(channelId);
  const data = await graphFetch(`/teams/${teamId}/channels/${encodedChannelId}/messages?$top=50`);
  return data.value || [];
}

async function replyToMessage(teamId, channelId, messageId, contentText) {
  const encodedChannelId = encodeURIComponent(channelId);
  return graphFetch(`/teams/${teamId}/channels/${encodedChannelId}/messages/${messageId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ body: { contentType: 'text', content: contentText } }),
  });
}

module.exports = { getAccessToken, graphFetch, getUserEmail, getChannelMessages, replyToMessage };
