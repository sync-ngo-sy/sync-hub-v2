# sync-comms

Turning a queued Communication row into a delivered message: the prose the platform owns,
the port it is handed through, and the Resend adapter behind that port.

- `email.py` — the `EmailSender` port and the two failures a caller has to tell apart:
  `EmailUnavailableError` (try again) and `UnsendableEmailError` (never will work).
- `templates.py` — the backend-owned templates, keyed by `communications.template_key`.
- `delivery.py` — resolving the verified recipient, rendering, sending, and writing the
  provider's evidence back onto the same row.
- `resend_sender.py` — the adapter. The only module that knows the provider's name.
