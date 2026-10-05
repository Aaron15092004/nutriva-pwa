// Ảnh sản phẩm. Với set tự làm, tên dòng hạt được in lên nhãn túi bằng HTML.
export default function ProductImage({ product, ratio = '292/252', className = '', style }) {
  const isDiy = product.type === 'diy';
  return (
    <div className={className} style={{ position: 'relative', aspectRatio: ratio, overflow: 'hidden', containerType: 'inline-size', background: 'var(--green-50)', ...style }}>
      <img
        src={product.image}
        alt={`${isDiy ? 'Set tự làm' : 'Sữa hạt'} ${product.name}`}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: isDiy ? 'fill' : 'cover' }}
      />
      {isDiy && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', left: '33%', width: '34.6%', top: '57.5%', height: '13%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            color: '#3b2f1e', lineHeight: 1.1,
          }}
        >
          <span style={{ fontSize: '2cqw', letterSpacing: '0.04em', fontWeight: 600 }}>SET TỰ LÀM TẠI NHÀ</span>
          <span style={{ fontSize: '2.6cqw', fontWeight: 700, marginTop: '0.6cqw' }}>{product.name}</span>
        </div>
      )}
    </div>
  );
}
