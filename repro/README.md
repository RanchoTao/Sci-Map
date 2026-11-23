# Repro scripts

Small CPU-only scripts referenced by `repro.command` in ledger records, organized as `repro/<domain>/`. Each must finish within its record's `timeout_minutes` and print one JSON object of metrics as its last stdout line.
