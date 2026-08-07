from .jobs import queue_app


def main() -> None:
    queue_app.run_worker(
        queues=["model"],
        concurrency=1,
        delete_jobs="never",
        shutdown_graceful_timeout=20,
    )


if __name__ == "__main__":
    main()
