"""The local demo seed: a whole platform's worth of data, written the way the product writes it.

`seed_demo.py` is the entry point. The split here is by what each part is responsible for:

- `cast` — who and what exists, as validated API payloads. Data only.
- `documents` — the CV files, built from the profiles they belong to.
- `identities` — auth users, the three kinds of Profile, and undoing a previous seed.
- `world` — the writes, all of them through the API's own services.
- `history` — the timestamps, the traffic, and the delivery states, applied afterwards.
"""
