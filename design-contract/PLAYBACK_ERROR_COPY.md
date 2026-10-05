# Playback Error Copy

Gateway registration and gateway reachability are different failures. Do not
infer missing authorization from a transport failure or a plain HTTP 502.

- `gateway_required`: "This device needs an authorized playback gateway. Configure one for this account or ask the account owner."
- `gateway_unavailable`: "The playback gateway could not be reached. Try again shortly or choose another source."
- `provider_connection_limit`: "This IPTV provider has reached its connection limit. Stop another stream or choose another provider."

Only an explicit provider connection-limit code or a recognized provider
connection-limit response may use connection-limit copy. A generic network,
preparation, rate-limit, or HTTP-status failure is not evidence of that limit.

This is an error-classification correction. It changes no playback controls,
assets, account authorization, provider capacity, or gateway grants.
