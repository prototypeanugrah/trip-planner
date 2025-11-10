"""Entrypoint for running the Pack Vote API locally."""

import uvicorn

from packvote.app import create_app

app = create_app()


def main() -> None:
    uvicorn.run(
        "main:create_app",
        host="0.0.0.0",
        port=8050,
        reload=True,
        factory=True,
    )


if __name__ == "__main__":
    main()
