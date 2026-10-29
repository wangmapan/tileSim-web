"""Verify the on-disk Bridge contract identity without opening runtime state."""

from contracts.schema_set import compute_schema_set_revision

import server


def main() -> None:
    expected = compute_schema_set_revision(server.CONTRACT_ROOT)
    actual = server.api_manifest()["schema_set_revision"]
    if actual != expected or server.SCHEMA_SET_REVISION != expected:
        raise SystemExit(f"schema-set revision drift: manifest={actual}, contracts={expected}")
    print(expected)


if __name__ == "__main__":
    main()
