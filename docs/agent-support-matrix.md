# DryLake Agent Support Matrix

This matrix lists the agent launchers supported by the VS Code extension phase handoff flow.
Only agents in `XU_PHASE_AGENTS` are selectable in the Control Room.

| Agent | ID | Kind | Executable | .sh | .bat | Missing install | Windows | macOS/Linux | Test coverage | Smoke status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | claude-code | terminal | claude | ✅ | ✅ | message + .md | ✅ | ✅ | ✅ | ✅ verified |
| OpenAI Codex | codex | terminal | codex | ✅ | ✅ | message + .md | ✅ | ✅ | ✅ | ✅ verified |
| Gemini CLI | gemini | terminal | gemini | ✅ | ✅ | message + .md | ✅ | ✅ | ✅ | 🔲 pending |
| Cursor CLI | cursor | terminal | cursor-agent | ✅ | ✅ | message + .md | ✅ | ✅ | ✅ | ✅ verified |
| GitHub Copilot Chat | copilot | vscode-command | github.copilot-chat | ❌ | ❌ | message + .md | ✅ | ✅ | ✅ | ✅ verified |

## Future agents (not yet implemented, must not be advertised)

- Blackbox
- Droid
- Aider
- Augment Code
- Continue
- Cline
