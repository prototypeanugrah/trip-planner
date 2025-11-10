"""Entrypoint for running the Pack Vote API locally."""

import uvicorn

from packvote.app import create_app


app = create_app()


def main() -> None:
    uvicorn.run("main:app", host="0.0.0.0", port=8090, reload=True)


if __name__ == "__main__":
    main()
