-- 画像アップロード用のStorageバケット作成とRLSポリシー設定

-- uploads バケットを作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads', 
  false,
  10485760, -- 10MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLSポリシー：認証済みユーザーは自分の組織フォルダにアップロード可能
CREATE POLICY "Users can upload to their organization folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = 'org' AND
  (storage.foldername(name))[2] = (
    SELECT organization_id::text 
    FROM users 
    WHERE id = auth.uid()
  )
);

-- RLSポリシー：認証済みユーザーは自分の組織のファイルを閲覧可能  
CREATE POLICY "Users can view their organization files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = 'org' AND
  (storage.foldername(name))[2] = (
    SELECT organization_id::text 
    FROM users 
    WHERE id = auth.uid()
  )
);

-- RLSポリシー：認証済みユーザーは自分の組織のファイルを削除可能
CREATE POLICY "Users can delete their organization files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads' AND
  (storage.foldername(name))[1] = 'org' AND
  (storage.foldername(name))[2] = (
    SELECT organization_id::text 
    FROM users 
    WHERE id = auth.uid()
  )
);