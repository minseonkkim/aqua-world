import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import licenses from '@/assets/licenses.json';

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  publisher?: string;
  repository?: string;
  licenseText?: string;
}

const ENTRIES = licenses as LicenseEntry[];

export default function LicensesPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTRIES;
    return ENTRIES.filter(
      e =>
        e.name.toLowerCase().includes(q) ||
        e.license.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'transparent', border: 'none', color: '#fff',
            fontSize: 32, lineHeight: 1, cursor: 'pointer',
            padding: '0 8px 0 0', marginLeft: -8,
          }}
          aria-label="뒤로"
        >
          ‹
        </button>
        <span>오픈소스 라이선스</span>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
          AquaWorld는 다음 오픈소스 패키지의 도움을 받아 만들어졌습니다.
          각 라이브러리의 라이선스에 따라 저작권자에게 감사드립니다.
        </p>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="패키지명 또는 라이선스 검색"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', borderRadius: 10,
            background: 'var(--color-surface)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff', fontSize: 14,
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 6 }}>
          총 {ENTRIES.length}개 패키지 · {filtered.length}개 표시 중
        </div>
      </div>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(entry => {
          const key = `${entry.name}@${entry.version}`;
          const isOpen = expanded.has(key);
          return (
            <div
              key={key}
              style={{
                background: 'var(--color-surface)',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <div
                onClick={() => toggle(key)}
                style={{
                  padding: '12px 14px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}>
                    {entry.name}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(77, 208, 225, 0.15)',
                    color: '#4dd0e1', fontWeight: 600, whiteSpace: 'nowrap',
                  }}>
                    {entry.license}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  <span>v{entry.version}</span>
                  {entry.publisher && <span>· {entry.publisher}</span>}
                </div>
                {entry.repository && (
                  <a
                    href={entry.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 11, color: '#4dd0e1', textDecoration: 'none', wordBreak: 'break-all' }}
                  >
                    {entry.repository}
                  </a>
                )}
              </div>
              {isOpen && entry.licenseText && (
                <pre style={{
                  margin: 0, padding: '12px 14px',
                  background: 'rgba(0,0,0,0.25)',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  fontSize: 11, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  color: 'var(--color-text-secondary)',
                  maxHeight: 320, overflowY: 'auto',
                  fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
                }}>
                  {entry.licenseText}
                </pre>
              )}
              {isOpen && !entry.licenseText && (
                <div style={{
                  padding: '12px 14px', fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  background: 'rgba(0,0,0,0.15)',
                }}>
                  라이선스 본문이 패키지에 포함되지 않았습니다. 라이선스 타입({entry.license})에 따라
                  자세한 내용은 저장소를 참고해주세요.
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 0',
            color: 'var(--color-text-secondary)', fontSize: 13,
          }}>
            검색 결과가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
