import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { TopBar, ErrorNote } from '../../components/ui.jsx';
import { ChipTabs } from '../../components/ds/charts.jsx';
import { PrimaryButton, BottomBar } from '../../components/ds/form.jsx';
import { StepBasic, StepHabits, StepAllergy, validateBasic, toProfile } from '../../components/ProfileForm.jsx';

export default function EditProfile() {
  const { user, update } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('step') ?? 'basic');
  const p = user.profile;
  const [v, setV] = useState({
    ...p,
    name: user.name,
    age: String(p.age),
    heightCm: String(p.heightCm),
    weightKg: String(p.weightKg),
    waistCm: String(p.waistCm),
    noAllergy: p.allergies.length === 0,
    healthNote: p.healthNote ?? '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch) => setV((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    const e = validateBasic(v);
    setErrors(e);
    if (Object.keys(e).length) {
      setTab('basic');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const u = await update({ name: v.name, profile: toProfile(v) });
      toast(`Đã cập nhật • Mục tiêu mới: ${u.health.targetKcal.toLocaleString('vi-VN')} kcal/ngày`);
      navigate(-1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Hồ sơ dinh dưỡng" />
      <main className="flex flex-col gap-6 px-4 pb-[calc(112px+var(--safe-b))] pt-2">
        <ChipTabs
          label="Mục hồ sơ"
          value={tab}
          onChange={setTab}
          items={[{ id: 'basic', label: 'Cơ bản' }, { id: 'habits', label: 'Thói quen' }, { id: 'allergy', label: 'Cần tránh' }]}
        />
        <div key={tab} className="page-fade">
          {tab === 'basic' && <StepBasic v={v} set={set} errors={errors} />}
          {tab === 'habits' && <StepHabits v={v} set={set} />}
          {tab === 'allergy' && <StepAllergy v={v} set={set} />}
        </div>
        <ErrorNote error={error} />
        <p className="text-center text-xs text-muted">Kế hoạch và gợi ý sẽ được tính lại ngay sau khi lưu.</p>
      </main>
      <BottomBar>
        <PrimaryButton loading={saving} onClick={save} className="flex-1">
          Lưu hồ sơ
        </PrimaryButton>
      </BottomBar>
    </>
  );
}
