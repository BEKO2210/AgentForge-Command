# Board — single source of truth (owned by LEAD)

Example state about half-way through the run described in this folder's README.
States: `todo` · `doing` · `blocked` · `done`.

| #  | Task                                    | Owner    | State   | Notes               |
|----|-----------------------------------------|----------|---------|---------------------|
| 1  | scaffold `bin/todo` + persistence       | backend  | done    | JSON store          |
| 2  | implement `add` / `list` / `done`       | backend  | doing   | core verbs          |
| 3  | argument parsing + `--help` text + UX   | frontend | done    | uses minimist       |
| 4  | unit test harness + 3 example tests     | quality  | done    | node --test         |
| 5  | wire E2E "happy path" run               | quality  | blocked | waits on #2         |
| 6  | docs: README quickstart + examples      | lead     | todo    | after green sign-off |
