import { useState } from "react";
import {
  Modal,
  Pressable,
  Share,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Typography } from "@/components/ui";
import {
  useCreateShareInvite,
  useJoinSharedResource,
  useLeaveSharedResource,
} from "@/hooks/useAccounts";
import type { SharedMember, SharedResourceType } from "@/types";
import { useAppTheme } from "@/theme/useAppTheme";

interface JoinWithCodeModalProps {
  visible: boolean;
  onClose: () => void;
}

export function JoinWithCodeModal({
  visible,
  onClose,
}: JoinWithCodeModalProps) {
  const { colors } = useAppTheme();
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const { mutate: joinResource, isPending } = useJoinSharedResource();

  function handleJoin() {
    setErrorMsg("");
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setErrorMsg("Ingresa el código de invitación (ej. UNPO-48K9)");
      return;
    }

    joinResource(trimmed, {
      onSuccess: (res) => {
        setCode("");
        setErrorMsg("");
        onClose();
        const joined = res.data;
        if (joined?.resourceType === "goal") {
          router.push(`/goals/${joined.resourceId}`);
        } else if (joined?.resourceId) {
          router.push(`/accounts/${joined.resourceId}`);
        }
      },
      onError: (err: any) => {
        setErrorMsg(
          err?.message ||
            "No se pudo unir con ese código. Verifica que no haya expirado.",
        );
      },
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/75 justify-center px-5">
        <View className="bg-surface-900 rounded-3xl p-6 gap-4 border border-surface-700">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-10 h-10 rounded-2xl bg-primary-500/15 items-center justify-center">
                <MaterialCommunityIcons
                  name="account-multiple-plus"
                  size={22}
                  color={colors.primary[500]}
                />
              </View>
              <View>
                <Typography variant="h3">Unirse con código</Typography>
                <Typography variant="caption" muted>
                  Cuenta o meta compartida
                </Typography>
              </View>
            </View>
            <Pressable onPress={onClose} className="p-1">
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.text.secondary}
              />
            </Pressable>
          </View>

          <Typography variant="caption" muted>
            Ingresa el código temporal que te compartió el propietario (por
            ejemplo: <Typography variant="caption" className="font-bold text-text-primary">UNPO-48K9</Typography>).
          </Typography>

          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase());
              if (errorMsg) setErrorMsg("");
            }}
            placeholder="UNPO-XXXX"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            className="bg-surface-800 border border-surface-600 rounded-2xl px-4 py-3.5 text-text-primary text-center text-xl font-bold tracking-widest"
          />

          {errorMsg ? (
            <View className="flex-row items-center gap-2 bg-danger-500/10 border border-danger-500/30 rounded-xl p-3">
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={18}
                color={colors.danger[500]}
              />
              <Typography
                variant="caption"
                className="flex-1 text-danger-500 font-medium"
              >
                {errorMsg}
              </Typography>
            </View>
          ) : null}

          <View className="flex-row gap-3 mt-1">
            <Button
              title="Cancelar"
              variant="ghost"
              className="flex-1"
              onPress={onClose}
            />
            <Button
              title="Unirme"
              loading={isPending}
              className="flex-1"
              onPress={handleJoin}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ShareResourceModalProps {
  visible: boolean;
  onClose: () => void;
  resourceType: SharedResourceType;
  resourceId: string;
  resourceName: string;
  isOwner: boolean;
  members: SharedMember[];
  onLeftResource?: () => void;
}

export function ShareResourceModal({
  visible,
  onClose,
  resourceType,
  resourceId,
  resourceName,
  isOwner,
  members,
  onLeftResource,
}: ShareResourceModalProps) {
  const { colors } = useAppTheme();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const { mutate: createInvite, isPending: isGenerating } =
    useCreateShareInvite();
  const { mutate: leaveResource, isPending: isLeaving } =
    useLeaveSharedResource();

  const resourceLabel = resourceType === "goal" ? "meta" : "cuenta";

  function handleGenerateCode() {
    setErrorMsg("");
    createInvite(
      { resourceType, resourceId },
      {
        onSuccess: (res) => {
          setInviteCode(res.data.code);
        },
        onError: (err: any) => {
          setErrorMsg(
            err?.message || "No se pudo generar el código de invitación.",
          );
        },
      },
    );
  }

  async function handleShareCode() {
    if (!inviteCode) return;
    try {
      await Share.share({
        message: `¡Sumate a mi ${resourceLabel} compartida "${resourceName}" en UNPO Finanzas! Ingresa el código ${inviteCode} en la opción "Unirse con código".`,
      });
    } catch {
      // Ignorar cancelación
    }
  }

  function handleRemoveMember(targetUserId?: string) {
    setErrorMsg("");
    leaveResource(
      { resourceType, resourceId, targetUserId },
      {
        onSuccess: () => {
          if (!targetUserId) {
            onClose();
            onLeftResource?.();
          }
        },
        onError: (err: any) => {
          setErrorMsg(
            err?.message || "No se pudo actualizar el acceso compartido.",
          );
        },
      },
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/75 justify-center px-5">
        <View className="bg-surface-900 rounded-3xl p-6 gap-4 border border-surface-700">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5 flex-1 pr-2">
              <View className="w-10 h-10 rounded-2xl bg-primary-500/15 items-center justify-center">
                <MaterialCommunityIcons
                  name="account-group"
                  size={22}
                  color={colors.primary[500]}
                />
              </View>
              <View className="flex-1">
                <Typography variant="h3" numberOfLines={1}>
                  Compartir {resourceLabel}
                </Typography>
                <Typography variant="caption" muted numberOfLines={1}>
                  {resourceName}
                </Typography>
              </View>
            </View>
            <Pressable onPress={onClose} className="p-1">
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.text.secondary}
              />
            </Pressable>
          </View>

          {/* Lista de miembros */}
          <View className="gap-2">
            <Typography variant="label" muted>
              Personas con acceso ({Math.max(1, members.length)})
            </Typography>
            {members.length === 0 ? (
              <View className="flex-row items-center justify-between bg-surface-800 border border-surface-600 rounded-2xl px-3.5 py-3">
                <View className="flex-row items-center gap-2.5">
                  <MaterialCommunityIcons
                    name="shield-account"
                    size={20}
                    color={colors.primary[500]}
                  />
                  <Typography className="font-medium text-sm">
                    Solo tú (Privada)
                  </Typography>
                </View>
                <View className="px-2 py-0.5 rounded-full bg-primary-500/15">
                  <Typography
                    variant="caption"
                    className="text-[10px] font-bold text-primary-500"
                  >
                    Propietario
                  </Typography>
                </View>
              </View>
            ) : (
              members.map((m) => (
                <View
                  key={m.userId}
                  className="flex-row items-center justify-between bg-surface-800 border border-surface-600 rounded-2xl px-3.5 py-2.5"
                >
                  <View className="flex-row items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <View className="w-8 h-8 rounded-full bg-surface-700 items-center justify-center">
                      <MaterialCommunityIcons
                        name={
                          m.role === "owner" ? "shield-account" : "account"
                        }
                        size={17}
                        color={
                          m.role === "owner"
                            ? colors.primary[500]
                            : colors.text.secondary
                        }
                      />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Typography
                        className="font-semibold text-sm"
                        numberOfLines={1}
                      >
                        {m.displayName}
                      </Typography>
                      <Typography variant="caption" muted>
                        {m.role === "owner" ? "Propietario" : "Miembro editor"}
                      </Typography>
                    </View>
                  </View>

                  {isOwner && m.role !== "owner" && (
                    <Pressable
                      onPress={() => handleRemoveMember(m.userId)}
                      disabled={isLeaving}
                      className="px-2.5 py-1 rounded-xl bg-danger-500/15 active:opacity-75"
                    >
                      <Typography
                        variant="caption"
                        className="text-danger-500 font-semibold text-xs"
                      >
                        Quitar
                      </Typography>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Generación de código (solo propietario) */}
          {isOwner ? (
            <View className="bg-surface-800 border border-surface-600 rounded-2xl p-4 gap-3">
              <Typography variant="caption" muted>
                Genera un código válido por 24 horas para que otra persona se
                una desde su app con{" "}
                <Typography
                  variant="caption"
                  className="font-semibold text-text-primary"
                >
                  &ldquo;Unirse con código&rdquo;
                </Typography>
                .
              </Typography>

              {inviteCode ? (
                <View className="gap-3">
                  <View className="bg-surface-700 border border-primary-500/40 rounded-2xl py-3 px-4 items-center">
                    <Typography variant="caption" muted>
                      Código de invitación (válido 24h)
                    </Typography>
                    <Typography
                      variant="h2"
                      className="tracking-widest text-primary-500 mt-0.5"
                    >
                      {inviteCode}
                    </Typography>
                  </View>
                  <Button
                    title="Enviar invitación"
                    onPress={handleShareCode}
                  />
                </View>
              ) : (
                <Button
                  title="Generar código de invitación"
                  variant="secondary"
                  loading={isGenerating}
                  onPress={handleGenerateCode}
                />
              )}
            </View>
          ) : (
            <View className="pt-1">
              <Button
                title={`Salir de esta ${resourceLabel} compartida`}
                variant="danger"
                loading={isLeaving}
                onPress={() => handleRemoveMember(undefined)}
              />
            </View>
          )}

          {errorMsg ? (
            <Typography
              variant="caption"
              className="text-danger-500 text-center"
            >
              {errorMsg}
            </Typography>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
