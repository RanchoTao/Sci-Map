"""Conservative redaction for derived text; original private archives stay intact."""
import re

TOKEN = re.compile(r'(?i)(?:sk-[A-Za-z0-9_-]{12,}|(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{12,}|AKIA[0-9A-Z]{16}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
ASSIGNMENT = re.compile(r'(?i)((?:api[_-]?key|access[_-]?token|client[_-]?secret|password|authorization|secret[_-]?key)\s*["\']?\s*[:=]\s*["\']?)([^\s"\',;}{]{6,})')
URL_CREDENTIAL = re.compile(r'(?i)(https?://|postgres(?:ql)?://|mysql://|mongodb(?:\+srv)?://)([^/\s:@]+):([^@\s/]+)@')

def redact(text):
    text = TOKEN.sub('[REDACTED_CREDENTIAL]', text)
    text = ASSIGNMENT.sub(lambda m: m.group(1) + '[REDACTED_VALUE]', text)
    return URL_CREDENTIAL.sub(lambda m: m.group(1) + '[REDACTED_USERINFO]@', text)

def preview_allowed(member):
    parts = member.lower().replace('\\', '/').split('/')
    name = parts[-1]
    return '.git' not in parts and not any(x in name for x in ('.env', 'credential', 'password', 'secret', 'id_rsa', 'id_ed25519', '.bash_history', '.zsh_history', 'known_hosts'))
