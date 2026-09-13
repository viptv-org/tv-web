# viptv

Shared vocabulary for the same viewing experience across viptv apps.

## Language

**Account**: A signed-in household identity owning profiles, paired devices and addon configuration.
_Avoid_: Profile, viewer

**Profile**: A person’s viewing identity within an account, with its own history, preferences, favorites and restrictions.
_Avoid_: Account, login

**Source**: A specific playable candidate supplied by an addon or IPTV provider for a title or episode.
_Avoid_: Title, provider

**Resume**: Continue a previously watched item from its saved position using the established source-selection intent.
_Avoid_: Play next

**Next episode**: The actual following playable episode identified by series ordering and availability, distinct from resuming the previous episode.
_Avoid_: Resume

**Viewing queue**: Continue Watching titles grouped for continued viewing; removing a queue title does not erase watched history.
_Avoid_: History, My List

**My List**: Titles explicitly saved by a profile for later viewing.
_Avoid_: Viewing queue

**Provider**: An IPTV subscription supplying a catalog or channel streams under its connection budget.
_Avoid_: Addon

**Addon**: An account-configured catalog or source discovery integration.
_Avoid_: Provider

**Direct play**: Delivery that preserves original encoded media for decoding on the viewing device.
_Avoid_: Transcode

**Remux**: Changing the media container without re-encoding its video or audio.
_Avoid_: Transcode

**Transcode**: Re-encoding a media track to meet a verified playback limitation.
_Avoid_: Remux, direct play
