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


# ---- publication gate: things that must never appear in a public ledger record
EMAIL = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
LOCAL_PATH = re.compile(r'(?i)(?<![A-Za-z])[A-Z]:[\\/][^\s"]+|(?:/home|/Users|/root|/mnt/user-data|/sessions)/[^\s"/]+')
CN_MOBILE = re.compile(r'(?<![\w.+-])1[3-9]\d{9}(?![\w.])')


def publication_problems(value, where='record'):
    """Return human-readable problems for strings that must not be published.

    Credentials, e-mail addresses, phone numbers and absolute local paths
    (which leak user names and private folder layouts) are rejected. Evidence
    should point at https URLs or repository-relative paths instead.
    """
    out = []
    if isinstance(value, dict):
        for k, v in value.items():
            out += publication_problems(v, f'{where}.{k}')
    elif isinstance(value, list):
        for i, v in enumerate(value):
            out += publication_problems(v, f'{where}[{i}]')
    elif isinstance(value, str):
        checks = (
            (TOKEN, 'looks like a credential'),
            (URL_CREDENTIAL, 'URL contains a user name or password'),
            (ASSIGNMENT, 'looks like a secret assignment'),
            (EMAIL, 'contains an e-mail address'),
            (CN_MOBILE, 'contains a phone number'),
            (LOCAL_PATH, 'contains an absolute local path; use a repository-relative path or https URL'),
        )
        for rx, msg in checks:
            if rx.search(value):
                out.append(f'{where} {msg}')
    return out
