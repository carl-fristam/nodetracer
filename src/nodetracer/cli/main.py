"""Command line interface for nodetracer."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import cast

from .inspect_cmd import VerbosityArg, run_inspect
from .view_cmd import run_view


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="nodetracer")
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect_parser = subparsers.add_parser("inspect", help="Inspect a trace JSON file")
    inspect_parser.add_argument("trace_file", type=Path, help="Path to trace JSON file")
    inspect_parser.add_argument(
        "--verbosity",
        choices=["minimal", "standard", "full"],
        default="standard",
        help="Console render verbosity",
    )
    inspect_parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable summary JSON instead of text output",
    )
    inspect_parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional output file path for --json summary",
    )
    inspect_parser.add_argument(
        "--summary",
        action="store_true",
        help="Print only the summary header (skip the rendered tree)",
    )

    view_parser = subparsers.add_parser("view", help="Start trace API server for the web viewer")
    view_parser.add_argument("directory", type=Path, help="Directory containing trace JSON files")
    view_parser.add_argument(
        "--port",
        type=int,
        default=8765,
        help="Port to bind the API server (default: 8765)",
    )
    view_parser.add_argument(
        "--no-open",
        action="store_true",
        help="Don't auto-open the browser",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "inspect":
        return run_inspect(
            args.trace_file,
            cast(VerbosityArg, args.verbosity),
            as_json=args.json,
            output_path=args.output,
            summary_only=args.summary,
        )

    if args.command == "view":
        return run_view(
            args.directory,
            port=args.port,
            open_browser=not args.no_open,
        )

    parser.error("Unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
