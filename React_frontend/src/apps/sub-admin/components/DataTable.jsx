export function DataTable({ columns, rows, emptyText, emptyColSpan }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} style={column.style}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows : (
            <tr>
              <td colSpan={emptyColSpan || columns.length} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
