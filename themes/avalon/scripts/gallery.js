'use strict';

const fs = require('fs');
const path = require('path');

hexo.extend.helper.register('gallery_items', function () {
  const dir = path.join(hexo.source_dir, 'assets', 'images', 'gallery');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((file) => /\.(jpe?g|png|webp|gif)$/i.test(file))
    .map((file) => {
      const match = file.match(/^(\d{2})(\d{2})(\d{2})/);
      const year = match ? 2000 + Number(match[1]) : 0;
      const month = match ? Number(match[2]) : 0;
      const day = match ? Number(match[3]) : 0;
      const stamp = match ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : 'Undated';
      const title = path.basename(file, path.extname(file)).replace(/^\d{6}[-_]?/, '') || 'Artwork';

      return {
        file,
        title,
        date: stamp,
        sortKey: year * 10000 + month * 100 + day,
        url: this.url_for(`/assets/images/gallery/${file}`)
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey || b.file.localeCompare(a.file));
});
