# BareGPS Track Editor 0.3.5 — build 78

Inputs retain the 150,000-point import limit, and adding/inserting now uses that same limit. Route Plan retains its 5,000-point allowance and displays the count. Inputs that will not fit offer a simplification preview; originals are retained. Oversized inputs explain the terrain limit before a request starts.

Replacing a plan entry retains its chosen reversal and updated heights. Reversing an input or plan copy removes recorded timestamps from the reversed copy; input Undo and Reset Track can restore them. About and README describe current behaviour. Development, validation and publication results are kept in the [linked development notes](../development.md).

The layers control is restored after import, saving and terrain work. Regression checks cover successful, cancelled and failed operations.

Validation: 155 unit/UI tests and nine native file-guard tests pass. TypeScript, production web builds and native preparation pass. Android Studio assembled the signed release APK and installed build 78 on SM-A075F. iPhone launch and website publication results are recorded separately after verification. Public Android downloads require the permanent release certificate and a non-debuggable build; earlier downloads remain available.
