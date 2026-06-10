"""
Headless passkey ceremony runner for the My Account passkey API (Path B).

Purpose
-------
Run the WebAuthn *registration* ceremony WITHOUT a browser, so that the
resulting credential's clientDataJSON.origin is EXACTLY the value the server
(ADRS) accepts -- e.g. "https://login.microsoft.com" -- instead of the page
origin a browser is forced to stamp (e.g. "https://passkeytest.login.microsoft.com:3000").

In a browser, navigator.credentials.create() hard-codes the origin to the
page URL and will not let you override it. The native Windows WebAuthn API
(used here via python-fido2's WindowsClient) instead lets the *caller* supply
the origin, while still performing a real Windows Hello (platform) attestation
that the server already accepts.

Flow
----
  1. You call POST /me/methods/fido (enroll) in Bruno and save the JSON.
  2. This script reads that enroll JSON, runs the Windows Hello prompt with
     origin = https://login.microsoft.com, and prints the activate request
     body (and URL) ready to paste into Bruno's POST .../activate call.

This is a LOCAL TEST HARNESS. It asserts an origin the script was not actually
served from; the hardware attestation is genuine, but the origin is one you
declare. Use it to exercise the activate endpoint, not as proof of a real
end-to-end browser client.

Usage
-----
  # validate the environment only (no hardware prompt):
  python ceremony_ctap.py --check

  # run the ceremony from a saved enroll response:
  python ceremony_ctap.py enroll.json

  # or pipe it in:
  Get-Content enroll.json | python ceremony_ctap.py

Options:
  --origin   Origin to embed in clientDataJSON (default: https://login.microsoft.com)
  --rpid     Override rp.id (default: keep the server's rp.id from enroll)
  --tenant   Tenant id used to build the activate URL (default: known test tenant)
  --name     displayName for the new passkey (default: passkey_<ms>_<rand>)
  --attachment {keep,platform,cross-platform,any}
             Force authenticator type (default: keep server's value; use
             "platform" to force Windows Hello)
  --strip-extensions  Drop ALL WebAuthn extensions (use if the prompt errors)
  --out      Write the activate body JSON to this file (default: activate-body.json)
"""

from __future__ import annotations

import argparse
import json
import random
import string
import sys
import time

# Defaults that match the React sample (src/services/MyAccountApiClient.js and
# src/authConfig.js) so the produced request matches what the app would send.
DEFAULT_ORIGIN = "https://login.microsoft.com"
DEFAULT_TENANT = "40e32adb-2fb9-4616-8604-d73950c432f1"
TEST_QUERY_STRING = "dc=ESTS-PUB-SCUS-FD000-TEST1-100&myaccessgrpccanary=true"
API_BASE = "https://login.microsoftonline.com"
API_PATH = "/api/v1.0"


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def generate_unique_passkey_name() -> str:
    """Mirror graphServiceUtils.generateUniquePasskeyName(): passkey_<ms>_<rand6>."""
    timestamp = int(time.time() * 1000)
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"passkey_{timestamp}_{suffix}"


def load_enroll(arg_path: str | None) -> dict:
    """Read the enroll response JSON from a file argument or stdin."""
    if arg_path:
        with open(arg_path, "r", encoding="utf-8") as fh:
            raw = fh.read()
    else:
        if sys.stdin.isatty():
            eprint("ERROR: no enroll file given and nothing piped on stdin.")
            eprint('       Run: python ceremony_ctap.py enroll.json')
            sys.exit(2)
        raw = sys.stdin.read()

    raw = raw.strip()
    if not raw:
        eprint("ERROR: enroll input is empty.")
        sys.exit(2)

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        eprint(f"ERROR: could not parse enroll JSON: {exc}")
        sys.exit(2)


def extract_creation_options(enroll: dict) -> dict:
    """Pull the WebAuthn creation options out of the enroll response.

    Mirrors PasskeyService.registerUserPasskey: enrollment.publicKey may be a
    JSON string or an object. Falls back to treating the whole document as the
    options if it already looks like creation options.
    """
    public_key = enroll.get("publicKey")
    if public_key is None:
        if "challenge" in enroll and "rp" in enroll:
            return enroll  # the document IS the creation options
        eprint("ERROR: enroll response has no 'publicKey' field.")
        sys.exit(2)
    if isinstance(public_key, str):
        try:
            return json.loads(public_key)
        except json.JSONDecodeError as exc:
            eprint(f"ERROR: enroll.publicKey is a string but not valid JSON: {exc}")
            sys.exit(2)
    return public_key


def get_activate_href(enroll: dict) -> str:
    """Mirror PasskeyService.getActivateHref()."""
    hal = (((enroll.get("_links") or {}).get("activate")) or {}).get("href")
    if hal:
        return hal
    if enroll.get("id"):
        return f"/me/methods/{enroll.get('type', 'fido')}/{enroll['id']}/activate"
    return ""


def build_activate_url(href: str, tenant: str) -> str:
    """Mirror MyAccountApiClient.buildUrl(): rebuild with one tenant + one query."""
    if not href:
        return ""
    pathname = href
    if pathname.lower().startswith("http://") or pathname.lower().startswith("https://"):
        # strip scheme://host
        rest = pathname.split("://", 1)[1]
        pathname = "/" + rest.split("/", 1)[1] if "/" in rest else "/"
    q = pathname.find("?")
    if q != -1:
        pathname = pathname[:q]
    idx = pathname.find(API_PATH)
    method_path = pathname[idx + len(API_PATH):] if idx != -1 else pathname
    return f"{API_BASE}/{tenant}{API_PATH}{method_path}?{TEST_QUERY_STRING}"


def prepare_options(options: dict, rpid: str | None, attachment: str,
                    strip_extensions: bool) -> dict:
    """Apply the same local-testing quirks the React sample applies.

    - optionally override rp.id
    - strip the credProtect policy (test env returns an inconsistent one)
    - replace timeout:0 with a sane default
    - optionally force authenticatorAttachment / drop all extensions
    challenge, user.id and excludeCredentials[].id are left as base64url
    strings; python-fido2's from_dict() decodes them.
    """
    opts = json.loads(json.dumps(options))  # deep copy

    if rpid:
        opts.setdefault("rp", {})
        opts["rp"]["id"] = rpid

    ext = opts.get("extensions")
    if isinstance(ext, dict):
        if strip_extensions:
            opts.pop("extensions", None)
        else:
            ext.pop("credentialProtectionPolicy", None)
            ext.pop("enforceCredentialProtectionPolicy", None)
            if not ext:
                opts.pop("extensions", None)

    if not opts.get("timeout"):
        opts["timeout"] = 120000

    if attachment != "keep":
        sel = opts.setdefault("authenticatorSelection", {})
        if attachment == "any":
            sel.pop("authenticatorAttachment", None)
        else:
            sel["authenticatorAttachment"] = attachment

    return opts


def run_self_check() -> int:
    """Validate imports and platform support without touching hardware."""
    try:
        from fido2.client import DefaultClientDataCollector  # noqa: F401
        from fido2.client.windows import WindowsClient
        from fido2.utils import websafe_encode  # noqa: F401
        from fido2.webauthn import PublicKeyCredentialCreationOptions  # noqa: F401
    except Exception as exc:  # pragma: no cover - environment dependent
        eprint(f"SELF-CHECK FAILED: cannot import python-fido2: {exc}")
        eprint("Install it with:  pip install fido2")
        return 1

    available = False
    try:
        available = bool(WindowsClient.is_available())
    except Exception as exc:
        eprint(f"SELF-CHECK WARNING: WindowsClient.is_available() raised: {exc}")

    print("SELF-CHECK OK: python-fido2 imported.")
    print(f"WindowsClient.is_available() -> {available}")
    if not available:
        eprint("NOTE: Windows WebAuthn API not available (needs Windows 10 19H1+).")
        return 1
    return 0


def run_ceremony(args) -> int:
    # Import here so --check can report a clean message if fido2 is missing.
    try:
        from fido2.client.windows import WindowsClient
        from fido2.utils import websafe_encode
    except Exception as exc:
        eprint(f"ERROR: python-fido2 is not installed: {exc}")
        eprint("Install it with:  pip install fido2")
        return 1

    if not WindowsClient.is_available():
        eprint("ERROR: Windows WebAuthn API unavailable (needs Windows 10 19H1+).")
        return 1

    enroll = load_enroll(args.enroll)
    raw_options = extract_creation_options(enroll)
    options = prepare_options(raw_options, args.rpid, args.attachment,
                              args.strip_extensions)

    server_rpid = (raw_options.get("rp") or {}).get("id")
    used_rpid = (options.get("rp") or {}).get("id")
    print(f"Server rp.id : {server_rpid}")
    print(f"Using rp.id  : {used_rpid}")
    print(f"Using origin : {args.origin}")

    collector = _make_collector(args.origin)
    if collector is None:
        return 1

    # WindowsClient anchors its dialog to the foreground window captured at
    # construction time, so build it right after the user confirms focus.
    eprint("")
    eprint("==> Make sure THIS terminal window is focused.")
    try:
        input("==> Press Enter to launch the Windows Hello prompt... ")
    except (EOFError, KeyboardInterrupt):
        eprint("Cancelled.")
        return 1

    handle = _foreground_handle()
    try:
        client = _make_windows_client(collector, args.origin, handle)
    except Exception as exc:
        eprint(f"ERROR: could not construct WindowsClient: {exc}")
        return 1

    try:
        result = client.make_credential(options)
    except Exception as exc:
        eprint(f"ERROR: make_credential failed: {type(exc).__name__}: {exc}")
        return 1

    raw_id = result.raw_id
    client_data = bytes(result.response.client_data)
    att_obj = bytes(result.response.attestation_object)

    public_key_credential = {
        "id": websafe_encode(raw_id),
        "attestationObject": websafe_encode(att_obj),
        "clientDataJSON": websafe_encode(client_data),
    }

    body = {
        "continuationToken": enroll.get("continuationToken"),
        "displayName": args.name or generate_unique_passkey_name(),
        "publicKeyCredential": public_key_credential,
    }

    # Sanity: show the origin the authenticator actually signed.
    try:
        signed = json.loads(client_data)
        print(f"\nSigned clientDataJSON.origin = {signed.get('origin')}")
        if signed.get("origin") != args.origin:
            eprint("WARNING: signed origin does not match the requested origin.")
    except Exception:
        pass

    if body["continuationToken"] is None:
        eprint("WARNING: no continuationToken found in enroll JSON; "
               "fill it into the body before calling activate.")

    activate_url = build_activate_url(get_activate_href(enroll), args.tenant)
    if activate_url:
        print(f"\nActivate URL (POST):\n  {activate_url}")

    body_json = json.dumps(body, indent=2)
    print("\nActivate request body:\n" + body_json)

    try:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(body_json + "\n")
        print(f"\nWrote activate body to: {args.out}")
    except OSError as exc:
        eprint(f"WARNING: could not write {args.out}: {exc}")

    return 0


def _make_collector(origin: str):
    """Build a DefaultClientDataCollector for the given origin (newer fido2)."""
    try:
        from fido2.client import DefaultClientDataCollector
    except Exception:
        return False  # signal: old API, handled in _make_windows_client
    return DefaultClientDataCollector(origin)


def _make_windows_client(collector, origin: str, handle):
    """Construct WindowsClient across python-fido2 API versions.

    Newer (>=1.2): WindowsClient(client_data_collector, handle=None, ...)
    Older (<1.2):  WindowsClient(origin, verify=..., handle=None)
    """
    import inspect

    from fido2.client.windows import WindowsClient

    params = list(inspect.signature(WindowsClient.__init__).parameters)
    # params[0] == 'self'
    first = params[1] if len(params) > 1 else ""
    if first in ("client_data_collector", "collector"):
        if collector in (None, False):
            from fido2.client import DefaultClientDataCollector
            collector = DefaultClientDataCollector(origin)
        return WindowsClient(collector, handle=handle)
    # old positional-origin API
    return WindowsClient(origin, handle=handle)


def _foreground_handle():
    """Return the current foreground window handle (or None)."""
    try:
        import ctypes

        return ctypes.windll.user32.GetForegroundWindow()
    except Exception:
        return None


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Headless Windows Hello passkey ceremony for the My Account API.")
    parser.add_argument("enroll", nargs="?",
                        help="Path to the enroll response JSON (or pipe via stdin).")
    parser.add_argument("--origin", default=DEFAULT_ORIGIN,
                        help=f"Origin for clientDataJSON (default: {DEFAULT_ORIGIN}).")
    parser.add_argument("--rpid", default=None,
                        help="Override rp.id (default: keep the server's rp.id).")
    parser.add_argument("--tenant", default=DEFAULT_TENANT,
                        help="Tenant id for the activate URL.")
    parser.add_argument("--name", default=None,
                        help="displayName for the passkey.")
    parser.add_argument("--attachment", default="keep",
                        choices=["keep", "platform", "cross-platform", "any"],
                        help='Force authenticator type ("platform" = Windows Hello).')
    parser.add_argument("--strip-extensions", action="store_true",
                        help="Drop ALL WebAuthn extensions.")
    parser.add_argument("--out", default="activate-body.json",
                        help="Where to write the activate body JSON.")
    parser.add_argument("--check", action="store_true",
                        help="Validate the environment only; no hardware prompt.")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    if args.check:
        return run_self_check()
    return run_ceremony(args)


if __name__ == "__main__":
    sys.exit(main())
