# Asymptote Diagrams

DBSMO can compile [Asymptote](https://asymptote.sourceforge.io/) source into problem
diagrams. Asymptote is a programming language, so source is treated as untrusted
executable input rather than HTML or an image format.

## Authoring

Staff with `admin:content` can expand **Asymptote diagram** in the create/edit problem
form, enter source, and choose **Render and attach**. The generated PNG is attached to
the problem and inserted with a normal `[[img:asy-...]]` token, so the existing statement
preview shows the final student view.

Statements imported from JSON may also contain a complete source block:

```text
The circle below has radius $5$.

<asy>
size(180);
draw(unitcircle);
dot((0,0));
</asy>

Find its area.
```

During dry-run/import or manual save, the server compiles the block, replaces it with a
deterministic image token, and stores only the PNG plus the rewritten statement. A
statement may contain at most eight blocks; each source block is limited to 40,000
characters.

## Security Boundary

Production rendering requires all of these layers:

1. `admin:content` authorization and a per-user render rate limit.
2. Explicit `ASYMPTOTE_ENABLED=true`; missing dependencies fail closed with HTTP 503.
3. Asymptote `-safe`, which disables source-level `system(...)` calls.
4. Linux `bubblewrap` with new process/network namespaces, no host home directory,
   read-only system/TeX trees, and one writable disposable work directory.
5. `prlimit` CPU, address-space, output-file, process, and file-descriptor limits; a
   wall-clock timeout; one active render per application process; and a monitored 32 MB
   work-directory ceiling.
6. PNG-only output. The server verifies PNG magic bytes, requires a non-zero image no
   larger than 4096x4096 or 16 million pixels, and applies the normal 4 MB image limit.
7. Existing authenticated `/api/files/[id]` serving with `nosniff`, private caching, and
   CSP sandbox headers.

SVG, PDF, HTML, WebGL, PRC, and raw `.asy` output are never served. SVG is deliberately
excluded because active content and external references make its browser security model
larger than a validated bitmap's.

Asymptote's own safe mode is not the complete boundary. Its manual states that safe mode
disables `system(...)`, while file reads outside the current directory remain possible
unless separately restricted, and URL reads may exist in libcurl-enabled builds. The OS
sandbox is therefore mandatory in production. See the official
[command-line options](https://asymptote.sourceforge.io/doc/Options.html) and
[file I/O documentation](https://asymptote.sourceforge.io/doc/Files.html).

## Limits And Failures

| Limit | Value |
| :-- | :-- |
| Source per block | 40,000 characters |
| Blocks per statement | 8 |
| Generated + uploaded images per set | 50 |
| Generated PNG | 4 MB |
| Dimensions | 4096 px per side, 16 million pixels total |
| Temporary workspace | 32 MB |
| Default wall time | 10 seconds |
| Concurrent renders per app process | 1 |
| Manual render requests | 10 per user per minute |

Compilation diagnostics are truncated and disposable paths are redacted before being
returned. Invalid source is a validation error; a missing/disabled sandbox is a service
availability error. Existing legacy statements with raw `<asy>` blocks show a safe
placeholder until an author saves or reimports them through the enabled renderer.

VPS installation and verification are in [SETUP.md](../SETUP.md).
