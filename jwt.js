// jwt.js
const { createRemoteJWKSet, jwtVerify } = require("jose");

// Where the pod fetches keys from (internal cluster URL)
const JWKS_URL = process.env.KEYCLOAK_JWKS_URL
    || "http://keycloak:8080/realms/journal/protocol/openid-connect/certs";

// What the token *claims* (your token's iss)
const EXPECTED_ISSUER = process.env.KEYCLOAK_ISSUER
    || "https://keycloakk.vm-app.cloud.cbh.kth.se/realms/journal";

// Your audience check (often "account" for Keycloak default client,
// but for frontend tokens it's usually your frontend clientId)
const EXPECTED_AUDIENCE = process.env.KEYCLOAK_AUDIENCE
    || "account";

// jose will cache keys internally and re-fetch when needed (kid rotation)
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

async function checkJwt(req, res, next) {
    try {
        const authHeader = req.headers.authorization || "";
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!match) return res.status(401).json({ message: "Missing Bearer token" });

        const token = match[1];

        const { payload } = await jwtVerify(token, jwks, {
            issuer: EXPECTED_ISSUER,
            audience: EXPECTED_AUDIENCE,
        });

        // Attach claims like Spring does
        req.auth = { payload };
        return next();
    } catch (err) {
        console.error("JWT Validation Error:", err?.message || err);
        return res.status(401).json({ message: err?.message || "Unauthorized" });
    }
}

module.exports = { checkJwt };