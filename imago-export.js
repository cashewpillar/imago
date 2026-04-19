const ImagoExport = {
  exportJSON: (key, filename) => {
    const data = localStorage.getItem(key);
    if (!data) return alert("No data to export");
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${key}-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  importJSON: (key, callback) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm("This will overwrite your current data for this application. Continue?")) return;
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const data = JSON.parse(event.target.result);
          localStorage.setItem(key, JSON.stringify(data));
          if (callback) callback(data);
          else location.reload();
        } catch (err) {
          alert("Invalid backup file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
};
