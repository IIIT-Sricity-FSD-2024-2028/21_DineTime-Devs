document.addEventListener('DOMContentLoaded', async () => {
    await StorageManager.ready();

    const profile = StorageManager.getData().profile || {};
    const nameEl = document.querySelector('.user-info h4');
    if (nameEl) nameEl.textContent = profile.name || 'Manager';

    const ids = StorageManager._getIds();
    if (!ids.restaurantId || !ids.managerId) {
        return;
    }

    try {
        const res = await StorageManager._request(
            `/restaurants/${ids.restaurantId}/revenue?manager_id=${encodeURIComponent(ids.managerId)}`,
            { headers: StorageManager._headers('manager') },
        );
        const revenue = res?.data || {};

        document.getElementById('rev-pending').textContent = `₹${revenue.pending_payout || 0}`;
        document.getElementById('rev-settled').textContent = `₹${revenue.paid_by_platform || 0}`;

        const history = revenue.settlement_history || [];
        const historyBody = document.getElementById('rev-history-body');
        historyBody.innerHTML = history.length
            ? history.map((entry) => `
                <tr>
                    <td>${new Date(entry.settled_at).toLocaleString()}</td>
                    <td>₹${entry.amount}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="2" style="text-align:center; color:#94A3B8;">No payouts yet.</td></tr>';
    } catch (error) {
        console.error('Failed to load revenue:', error);
    }
});
