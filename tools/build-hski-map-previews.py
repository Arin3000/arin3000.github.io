"""Read Unity material GUID bindings and export small, unmodified texture previews.

Usage: python tools/build-hski-map-previews.py <independent Unity project>
Requires Pillow. Does not write to the Unity project.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
from PIL import Image

unity = Path(sys.argv[1]).resolve()
assets = unity / 'Assets'
output = Path(__file__).resolve().parents[1] / 'source/assets/hski-study/maps'
output.mkdir(parents=True, exist_ok=True)
materials = [('bdy', '身体 / 扣子'), ('hir', '头发'), ('fce', '面部 / 眼白 / 面部线条'),
             ('eye', '虹膜'), ('ehl', '眼睛亮点'), ('hirco', '发饰')]
definitions = {
    'BaseMap': ('底色贴图', '同一个变量由不同材质绑定不同图片；眼睛亮点也使用自己的 BaseMap。'),
    'ShadeMap': ('暗部颜色', 'RGB 提供暗部颜色；Alpha 也参与原版明暗和肤色处理。'),
    'DefMap': ('材质参数', 'R：明暗偏移；G：光滑度；B：金属度；A：反光强度。颜色是参数编码，不是要直接画出的颜色。'),
    'HighlightMap': ('头发亮色块', '头发专用亮色，与 BaseMap 混合后再参与后续明暗。'),
    'RampMap': ('明暗查表', '原图只有 4 行；预览纵向放大，便于看清各行。'),
    'RampAddMap': ('局部补色', 'RGB 添加颜色，Alpha 参与反光染色。窄条预览纵向放大。'),
    'LayerMap': ('面部叠层', '这里展示材质绑定的图；是否参与当前画面还取决于关键字、权重和教学步骤。'),
    'Cubemap': ('环境反射', '展示 CharacterSpecCube 使用的 skybox.png 六面展开源图，不是人物 UV 贴图。'),
    'MatCap': ('可选反射球贴图', '本快照人物材质的 _ReflectionSphereMap 均未绑定；这条可选路径没有实际贴图可预览。'),
}
catalog = {key: {'title': title, 'note': note, 'variants': []} for key, (title, note) in definitions.items()}
guid_index = {}
for meta in assets.rglob('*.meta'):
    match = re.search(r'^guid: ([0-9a-f]{32})', meta.read_text(encoding='utf-8-sig'), re.M)
    if match:
        guid_index[match.group(1)] = Path(str(meta)[:-5])

def export(path, key, material, label, guid, matfile=None, enabled=None):
    image = Image.open(path).convert('RGBA')
    size = list(image.size)
    strip = image.height <= 16
    stem = f'{key.lower()}-{material}'
    channels = {}
    modes = ['RGB', 'A'] + (['R', 'G', 'B'] if key == 'DefMap' else [])
    for channel in modes:
        preview = image.convert('RGB') if channel == 'RGB' else image.getchannel(channel).convert('RGB')
        # Split before resizing: RGBA resampling premultiplies alpha and can erase
        # parameter values or hidden RGB. These are data previews, not compositing.
        if not strip:
            preview.thumbnail((384, 384), Image.Resampling.LANCZOS)
        name = f'{stem}-{channel.lower()}.webp'
        preview.save(output / name, 'WEBP', lossless=True, method=6)
        channels[channel] = name
    catalog[key]['variants'].append({
        'id': material, 'label': label, 'file': path.name, 'asset': path.relative_to(unity).as_posix(),
        'guid': guid, 'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'material': matfile, 'enabled': enabled, 'size': size, 'strip': strip, 'channels': channels,
    })

for material, label in materials:
    mat = assets / f'PaintingStudy/Materials/m_{material} 2_fixed_study.mat'
    text = mat.read_text(encoding='utf-8-sig')
    for key, details in re.findall(r'- _(\w+):\r?\n        m_Texture: \{([^}]+)\}', text):
        if key not in catalog:
            continue
        match = re.search(r'guid: ([0-9a-f]{32})', details)
        if not match:
            continue
        enabled = None
        if key in ('LayerMap', 'RampAddMap'):
            toggle = re.search(rf'- _Enable{key}: (\d+)', text)
            enabled = bool(int(toggle.group(1))) if toggle else None
        export(guid_index[match.group(1)], key, material, label, match.group(1), mat.name, enabled)

cube = assets / 'Reverse/Texture2D/skybox.png'
cube_guid = re.search(r'^guid: (.+)', Path(str(cube)+'.meta').read_text(), re.M).group(1)
export(cube, 'Cubemap', 'environment', '人物环境反射 / 六面展开', cube_guid)
(output / 'index.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Exported {sum(len(x["variants"]) for x in catalog.values())} bindings; {sum(p.stat().st_size for p in output.glob("*.webp")):,} bytes of thumbnails.')
