import asyncio
import json
import sys

from crawl4ai import AsyncWebCrawler


async def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("missing url")

    url = sys.argv[1]

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url)
        title = getattr(result, "title", None)
        markdown = getattr(result, "markdown", "") or ""
        metadata = getattr(result, "metadata", None) or {}
        cover = (
            metadata.get("og:image")
            or metadata.get("og_image")
            or metadata.get("image")
            or metadata.get("thumbnail")
        )
        logo = (
            metadata.get("favicon")
            or metadata.get("icon")
            or metadata.get("shortcut_icon")
        )

        payload = {
            "title": title or metadata.get("title") or url,
            "markdown": markdown,
            "excerpt": markdown[:180].replace("\n", " "),
            "coverImageUrl": cover,
            "logoUrl": logo,
            "metadata": metadata,
        }

        print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
