const ImagoExport = {
  exportJSON: (key, filename) => {
    const data = localStorage.getItem(key);
    if (!data) return alert("No data to export");
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename || `${key}-backup.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  },
  importJSON: (key, callback) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
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
        } finally {
          document.body.removeChild(input);
        }
      };
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
  }
};
