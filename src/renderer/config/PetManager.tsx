import { useState, useEffect, useRef, useCallback } from 'react';
import type { PetMetadata, PetPackage, ImportStep } from '../shared/types';
import { HTTP_SERVER_PORT } from '../shared/constants';
import PreviewPanel from './PreviewPanel';

/** 上传步骤模板 */
const UPLOAD_STEP_TEMPLATES = [
  { label: '上传文件' },
  { label: '解析宠物包' },
  { label: '生成精灵图' },
  { label: '安装宠物' },
];

/** 支持的文件扩展名 */
const ACCEPTED_EXTENSIONS = '.zip,.7z,.rar,.png,.gif,.webp,.jpg,.jpeg';

/** 延迟工具函数 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PetManager — 宠物管理页面
 * 已安装宠物列表（卡片式）+ 上传区域 + 预览面板
 */
export default function PetManager() {
  const [pets, setPets] = useState<PetMetadata[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [currentPetId, setCurrentPetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSteps, setUploadSteps] = useState<ImportStep[]>([]);
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPets = useCallback(async () => {
    try {
      const list = await window.configAPI.getPets();
      setPets(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  // 自动选中第一个宠物
  useEffect(() => {
    if (pets.length > 0 && !selectedPetId) {
      setSelectedPetId(pets[0].id);
    }
  }, [pets, selectedPetId]);

  const handleSelectPet = (petId: string) => {
    setSelectedPetId(petId);
  };

  const handleSetCurrent = async (petId: string) => {
    try {
      await window.configAPI.selectPet(petId);
      setCurrentPetId(petId);
    } catch {
      // ignore
    }
  };

  const handleDeletePet = async (petId: string) => {
    if (!window.confirm('确定要删除这个宠物吗？此操作不可撤销。')) return;
    try {
      await window.configAPI.deletePet(petId);
      if (selectedPetId === petId) setSelectedPetId(null);
      if (currentPetId === petId) setCurrentPetId(null);
      await loadPets();
    } catch {
      // ignore
    }
  };

  const handleFile = async (file: File) => {
    if (!file || uploading) return;

    setUploading(true);
    const steps: ImportStep[] = UPLOAD_STEP_TEMPLATES.map((s) => ({
      label: s.label,
      status: 'pending' as const,
    }));
    setUploadSteps(steps);

    // 步骤 1：上传文件
    setUploadSteps((prev) =>
      prev.map((s, i) => (i === 0 ? { ...s, status: 'processing' } : s)),
    );

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', uploadName || file.name);
      formData.append('description', uploadDesc);

      const response = await fetch(
        `http://localhost:${HTTP_SERVER_PORT}/api/pets/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || `上传失败: ${response.status}`);
      }

      const result: PetPackage = await response.json();

      // 步骤 1 完成
      setUploadSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: 'done' } : s)),
      );

      // 步骤 2：解析宠物包
      setUploadSteps((prev) =>
        prev.map((s, i) => (i === 1 ? { ...s, status: 'processing' } : s)),
      );
      await delay(400);
      setUploadSteps((prev) =>
        prev.map((s, i) => (i === 1 ? { ...s, status: 'done' } : s)),
      );

      // 步骤 3：生成精灵图
      setUploadSteps((prev) =>
        prev.map((s, i) => (i === 2 ? { ...s, status: 'processing' } : s)),
      );
      await delay(400);
      const convertDetail =
        result.warnings.length > 0 ? result.warnings[0] : undefined;
      setUploadSteps((prev) =>
        prev.map((s, i) =>
          i === 2 ? { ...s, status: 'done', detail: convertDetail } : s,
        ),
      );

      // 步骤 4：安装宠物
      setUploadSteps((prev) =>
        prev.map((s, i) => (i === 3 ? { ...s, status: 'processing' } : s)),
      );
      await delay(300);
      setUploadSteps((prev) =>
        prev.map((s, i) => (i === 3 ? { ...s, status: 'done' } : s)),
      );

      // 重置输入
      setUploadName('');
      setUploadDesc('');

      // 重新加载宠物列表并选中新宠物
      await loadPets();
      if (result.metadata.id) {
        setSelectedPetId(result.metadata.id);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setUploadSteps((prev) =>
        prev.map((s) =>
          s.status === 'processing'
            ? { ...s, status: 'error', detail: errorMsg }
            : s,
        ),
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  /** 获取步骤图标的显示文本 */
  const getStepIcon = (step: ImportStep, index: number): string => {
    switch (step.status) {
      case 'done':
        return 'OK';
      case 'error':
        return '!';
      case 'processing':
        return '...';
      default:
        return String(index + 1);
    }
  };

  if (loading) {
    return <div className="loading-text">加载宠物列表中…</div>;
  }

  return (
    <div className="pet-manager">
      <div className="pet-manager-left">
        <div className="section-card">
          <h2 className="section-title">已安装宠物</h2>
          {pets.length === 0 ? (
            <div className="loading-text">暂无已安装的宠物，请在下方上传宠物包</div>
          ) : (
            <div className="pet-grid">
              {pets.map((pet) => (
                <div
                  key={pet.id}
                  className={`pet-card ${selectedPetId === pet.id ? 'selected' : ''} ${currentPetId === pet.id ? 'current' : ''}`}
                  onClick={() => handleSelectPet(pet.id)}
                >
                  <div className="pet-card-thumbnail">
                    <img
                      src={`http://localhost:${HTTP_SERVER_PORT}/api/pets/${pet.id}/spritesheet`}
                      alt={pet.name}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="pet-card-info">
                    <div className="pet-card-name">{pet.name}</div>
                    <div className="pet-card-desc">{pet.description || '无描述'}</div>
                    {currentPetId === pet.id && (
                      <span className="pet-card-badge">当前</span>
                    )}
                  </div>
                  <div className="pet-card-actions">
                    <button
                      className="btn btn-small btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetCurrent(pet.id);
                      }}
                      disabled={currentPetId === pet.id}
                    >
                      {currentPetId === pet.id ? '已选用' : '设为当前'}
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePet(pet.id);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-card">
          <h2 className="section-title">上传宠物包</h2>
          <div className="upload-input-row">
            <input
              className="form-input"
              type="text"
              placeholder="宠物名称（可选，默认使用文件名）"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              disabled={uploading}
            />
          </div>
          <div className="upload-input-row">
            <input
              className="form-input"
              type="text"
              placeholder="宠物描述（可选）"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              disabled={uploading}
            />
          </div>
          <div
            className={`upload-area ${dragOver ? 'dragover' : ''}`}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="upload-area-title">
              {uploading ? '正在处理…' : '点击或拖拽文件到此处'}
            </div>
            <div className="upload-area-hint">
              支持 .zip / .7z / .rar / 图片格式（.png .gif .webp .jpg）
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
          </div>

          {uploadSteps.length > 0 && (
            <div className="upload-steps">
              {uploadSteps.map((step, i) => (
                <div key={i} className={`upload-step ${step.status}`}>
                  <div className="upload-step-icon">{getStepIcon(step, i)}</div>
                  <div className="upload-step-label">{step.label}</div>
                  {step.detail && (
                    <div className="upload-step-detail">{step.detail}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pet-manager-right">
        {selectedPetId ? (
          <PreviewPanel petId={selectedPetId} />
        ) : (
          <div className="preview-panel">
            <div className="preview-title">动画预览</div>
            <div className="preview-canvas-wrapper">
              <div className="preview-loading">请选择一个宠物</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
